"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const POInput = z.object({
  supplier_id: z.string().uuid(),
  po_number: z.string().min(1, "PO number is required"),
  expected_date: z.string().optional(),
  notes: z.string().optional(),
})

const POItemInput = z.object({
  po_id: z.string().uuid(),
  product_id: z.string().uuid(),
  project_id: z.string().optional().nullable().or(z.literal("")),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
})

function nullify(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function createPO(
  input: z.infer<typeof POInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = POInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      org_id: ctx.orgId,
      supplier_id: parsed.data.supplier_id,
      po_number: parsed.data.po_number.trim(),
      expected_date: nullify(parsed.data.expected_date),
      notes: nullify(parsed.data.notes),
      status: "draft",
      total_amount: 0,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/purchases")
  redirect(`/purchases/${data.id}`)
}

export async function updatePOStatus(
  id: string,
  status: "draft" | "ordered" | "received" | "cancelled"
): Promise<{ error?: string }> {
  if (status === "received") {
    return { error: "PO status cannot be set to 'received' directly. Use receivePOItems instead." }
  }

  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/purchases")
  revalidatePath(`/purchases/${id}`)
  return {}
}

async function recalculatePOTotal(po_id: string, org_id: string) {
  const supabase = await createSupabaseClient()
  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("quantity, unit_price")
    .eq("po_id", po_id)
    .eq("org_id", org_id)
    
  let total = 0
  if (items) {
    total = items.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0)
  }
  
  await supabase
    .from("purchase_orders")
    .update({ total_amount: total })
    .eq("id", po_id)
    .eq("org_id", org_id)
}

export async function addPOItem(
  input: z.infer<typeof POItemInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = POItemInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", parsed.data.po_id)
    .eq("org_id", ctx.orgId)
    .single()

  if (po?.status === "received" || po?.status === "cancelled") {
    return { error: "Cannot modify items for this PO status" }
  }

  const { error } = await supabase.from("purchase_order_items").insert({
    org_id: ctx.orgId,
    po_id: parsed.data.po_id,
    product_id: parsed.data.product_id,
    project_id: parsed.data.project_id || null,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
  })

  if (error) return { error: error.message }

  await recalculatePOTotal(parsed.data.po_id, ctx.orgId)
  revalidatePath(`/purchases/${parsed.data.po_id}`)
  return {}
}

export async function deletePOItem(
  itemId: string,
  poId: string
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .eq("org_id", ctx.orgId)
    .single()

  if (po?.status === "received" || po?.status === "cancelled") {
    return { error: "Cannot modify items for this PO status" }
  }

  const { error } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("id", itemId)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  await recalculatePOTotal(poId, ctx.orgId)
  revalidatePath(`/purchases/${poId}`)
  return {}
}

export async function updatePO(
  id: string,
  input: z.infer<typeof POInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = POInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      supplier_id: parsed.data.supplier_id,
      po_number: parsed.data.po_number.trim(),
      expected_date: nullify(parsed.data.expected_date),
      notes: nullify(parsed.data.notes),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/purchases")
  revalidatePath(`/purchases/${id}`)
  return {}
}

export async function receivePOItems(
  poId: string,
  locationId: string,
  idempotencyKey: string,
  itemsToReceive: { id: string; product_id: string; quantityToReceive: number }[]
): Promise<{ error?: string }> {
  try {
    const ctx = await requireOrgContext()
    const supabase = await createSupabaseClient()
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) throw new Error("Unauthorized")

    if (!locationId) throw new Error("Location ID is required")
    if (!itemsToReceive || itemsToReceive.length === 0) {
      throw new Error("No items to receive")
    }

    // Call the RPC for atomic transaction
    const { error: rpcError } = await (supabase.rpc as any)('rpc_receive_po_items', {
      p_po_id: poId,
      p_location_id: locationId,
      p_org_id: ctx.orgId,
      p_user_id: authUser.user.id,
      p_items: itemsToReceive,
      p_idempotency_key: idempotencyKey
    })

    if (rpcError) {
      throw new Error(rpcError.message)
    }

    revalidatePath("/purchases")
    revalidatePath(`/purchases/${poId}`)
    return {}
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function createCostFromPO(poId: string): Promise<{ costId?: string; error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  // 1. Get PO details
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .eq("id", poId)
    .eq("org_id", ctx.orgId)
    .single()

  if (poError || !po) {
    return { error: poError?.message || "Purchase order not found" }
  }

  // 2. Create cost record
  const { data: cost, error: costError } = await supabase
    .from("costs")
    .insert({
      org_id: ctx.orgId,
      po_id: po.id,
      supplier_id: po.supplier_id,
      category: "other",
      subtotal_satang: po.total_amount * 100, // Assuming total_amount is in Baht
      vat_amount_satang: 0,
      wht_amount_satang: 0,
      amount_satang: po.total_amount * 100,
      vendor: (po.suppliers as any)?.name || "Unknown Supplier",
      notes: `Generated from PO: ${po.po_number}`,
    })
    .select("id")
    .single()

  if (costError) {
    return { error: costError.message }
  }

  return { costId: cost.id }
}

export async function requestPOApproval(id: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("purchase_orders")
    .update({ 
      status: "pending_approval", 
      requested_by: ctx.userId 
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    
  if (error) return { error: error.message }
  revalidatePath(`/purchases/${id}`)
  return {}
}

export async function approvePO(id: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { error } = await supabase
    .from("purchase_orders")
    .update({ 
      status: "ordered", 
      approved_by: ctx.userId,
      approved_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    
  if (error) return { error: error.message }
  revalidatePath("/purchases")
  revalidatePath(`/purchases/${id}`)
  return {}
}
