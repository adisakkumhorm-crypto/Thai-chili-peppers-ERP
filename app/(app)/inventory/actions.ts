"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import type { Enums } from "@/lib/types/database"

const TransactionInput = z.object({
  product_id: z.string().uuid(),
  location_id: z.string().uuid(),
  transaction_type: z.enum(["receive", "issue", "transfer", "adjust"]),
  quantity: z.coerce.number().int(),
  reference_no: z.string().optional().nullable(),
  batch_qr_code: z.string().optional().nullable(),
})

export async function processInventoryTransaction(
  input: z.infer<typeof TransactionInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = TransactionInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { product_id, location_id, transaction_type, quantity, reference_no, batch_qr_code } = parsed.data

  // 1. Record Transaction
  const { error: txError } = await supabase.from("inventory_transactions").insert({
    org_id: ctx.orgId,
    product_id,
    location_id,
    transaction_type: transaction_type as Enums<"inventory_transaction_type">,
    quantity,
    reference_no,
    batch_qr_code,
    created_by: ctx.userId,
  })

  if (txError) return { error: txError.message }

  // 2. Update Balance
  const { data: balance } = await supabase
    .from("inventory_balances")
    .select("on_hand_quantity")
    .eq("product_id", product_id)
    .eq("location_id", location_id)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (balance) {
    await supabase
      .from("inventory_balances")
      .update({ on_hand_quantity: balance.on_hand_quantity + quantity })
      .eq("product_id", product_id)
      .eq("location_id", location_id)
      .eq("org_id", ctx.orgId)
  } else {
    await supabase.from("inventory_balances").insert({
      org_id: ctx.orgId,
      product_id,
      location_id,
      on_hand_quantity: quantity,
      allocated_quantity: 0,
    })
  }

  // 3. Update Global Product Stock
  const { data: product } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", product_id)
    .eq("org_id", ctx.orgId)
    .single()

  if (product) {
    await supabase
      .from("products")
      .update({ stock_quantity: product.stock_quantity + quantity })
      .eq("id", product_id)
      .eq("org_id", ctx.orgId)
  }

  revalidatePath("/inventory")
  return {}
}
