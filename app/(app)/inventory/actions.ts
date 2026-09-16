"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import type { Enums } from "@/lib/types/database"

const TransactionInput = z.object({
  product_id: z.string().uuid(),
  location_id: z.string().uuid(),
  to_location_id: z.string().uuid().optional().nullable(),
  transaction_type: z.enum(["receive", "issue", "transfer", "adjust"]),
  quantity: z.coerce.number().int(),
  unit_cost: z.coerce.number().min(0).optional().nullable(),
  reference_no: z.string().optional().nullable(),
  batch_qr_code: z.string().optional().nullable(),
  idempotency_key: z.string().optional(),
})

export async function processInventoryTransaction(
  input: z.infer<typeof TransactionInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = TransactionInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { product_id, location_id, to_location_id, transaction_type, quantity, unit_cost, reference_no, batch_qr_code, idempotency_key } = parsed.data

  if (transaction_type === "receive") {
    if (unit_cost === undefined || unit_cost === null || unit_cost < 0) {
      return { error: "Unit cost is required and cannot be negative for receiving" }
    }
    const key = idempotency_key || crypto.randomUUID();
    
    const { error: rpcError } = await (supabase as any).rpc('rpc_receive_stock_direct', {
      p_org_id: ctx.orgId,
      p_location_id: location_id,
      p_product_id: product_id,
      p_quantity: quantity,
      p_unit_cost: unit_cost,
      p_reference_no: reference_no || null,
      p_batch_qr_code: batch_qr_code || null,
      p_idempotency_key: key,
      p_user_id: ctx.userId
    });

    if (rpcError) {
      return { error: rpcError.message || rpcError.details || "Unknown error" }
    }
    
    revalidatePath("/inventory")
    return {}
  }

  if (transaction_type === "issue") {
    const issueQty = Math.abs(quantity);
    const key = idempotency_key || crypto.randomUUID();
    
    const { error: rpcError } = await (supabase as any).rpc('rpc_issue_stock', {
      p_org_id: ctx.orgId,
      p_mode: 'DIRECT',
      p_quantity: issueQty,
      p_idempotency_key: key,
      p_user_id: ctx.userId,
      p_product_id: product_id,
      p_location_id: location_id,
      p_reference_no: reference_no || null,
      p_sales_order_item_id: null
    });

    if (rpcError) {
      return { error: rpcError.message || rpcError.details || "Unknown error" }
    }
    
    revalidatePath("/inventory")
    return {}
  }

  if (transaction_type === "transfer") {
    if (!to_location_id) {
      return { error: "Destination location is required for transfer" }
    }
    const key = idempotency_key || crypto.randomUUID();
    
    const { error: rpcError } = await (supabase as any).rpc('rpc_transfer_stock', {
      p_org_id: ctx.orgId,
      p_product_id: product_id,
      p_from_location_id: location_id,
      p_to_location_id: to_location_id,
      p_quantity: quantity,
      p_reference_no: reference_no || null,
      p_idempotency_key: key,
      p_user_id: ctx.userId
    });

    if (rpcError) {
      return { error: rpcError.message || rpcError.details || "Unknown error" }
    }
    
    revalidatePath("/inventory")
    return {}
  }

  if (transaction_type === "adjust") {
    // Validate and process adjust
    if (quantity === 0) {
      return { error: "Quantity cannot be zero for adjustment" }
    }
    
    const key = idempotency_key || crypto.randomUUID();
    
    // For positive adjustment, unit_cost is required and must be non-negative
    if (quantity > 0) {
      if (unit_cost === undefined || unit_cost === null || unit_cost < 0) {
        return { error: "Unit cost is required and cannot be negative for positive adjustment" }
      }
    }
    
    const { error: rpcError } = await (supabase as any).rpc('rpc_adjust_stock', {
      p_org_id: ctx.orgId,
      p_product_id: product_id,
      p_location_id: location_id,
      p_quantity: quantity,
      p_unit_cost: unit_cost,
      p_reference_no: reference_no || null,
      p_reason: batch_qr_code || null,
      p_idempotency_key: key,
      p_user_id: ctx.userId
    });

    if (rpcError) {
      return { error: rpcError.message || rpcError.details || "Unknown error" }
    }
    
    revalidatePath("/inventory")
    return {}
  }
}
