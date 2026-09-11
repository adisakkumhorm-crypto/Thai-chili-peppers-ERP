"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import type { Enums } from "@/lib/types/database"

const SalesOrderInput = z.object({
  channel_id: z.string().uuid().optional().nullable().or(z.literal("")),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_phone: z.string().optional().nullable(),
  shipping_address: z.string().optional().nullable(),
  payment_method: z.enum(["bank_transfer", "cod", "credit_card", "platform_wallet"]),
  notes: z.string().optional().nullable(),
})

const OrderItemInput = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  location_id: z.string().uuid({ message: "Location is required" }),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
})

function generateOrderNumber() {
  const date = new Date()
  const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth()+1).toString().padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `SO-${yymm}-${rand}`
}

export async function createSalesOrder(input: z.infer<typeof SalesOrderInput>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = SalesOrderInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from("sales_orders").insert({
    org_id: ctx.orgId,
    order_number: generateOrderNumber(),
    channel_id: parsed.data.channel_id || null,
    customer_name: parsed.data.customer_name,
    customer_phone: parsed.data.customer_phone || null,
    shipping_address: parsed.data.shipping_address || null,
    payment_method: parsed.data.payment_method as Enums<"payment_method_type">,
    notes: parsed.data.notes || null,
    status: "pending",
    total_amount: 0,
    created_by: ctx.userId,
  }).select("id").single()

  if (error) return { error: error.message }
  
  revalidatePath("/sales")
  redirect(`/sales/${data.id}`)
}

async function recalculateOrderTotal(orderId: string, orgId: string) {
  const supabase = await createSupabaseClient()
  const { data: items } = await supabase
    .from("sales_order_items")
    .select("quantity, unit_price")
    .eq("order_id", orderId)
    .eq("org_id", orgId)
    
  let total = 0
  if (items) {
    total = items.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0)
  }
  
  await supabase
    .from("sales_orders")
    .update({ total_amount: total })
    .eq("id", orderId)
    .eq("org_id", orgId)
}

export async function addOrderItem(input: z.infer<typeof OrderItemInput>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = OrderItemInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  
  const { error } = await (supabase.rpc as any)('rpc_reserve_so_item', {
    p_order_id: parsed.data.order_id,
    p_product_id: parsed.data.product_id,
    p_location_id: parsed.data.location_id,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unit_price,
    p_org_id: ctx.orgId
  })

  if (error) return { error: error.message }

  // Total is updated by RPC
  revalidatePath(`/sales/${parsed.data.order_id}`)
  return {}
}

export async function deleteOrderItem(itemId: string, orderId: string, productId: string, qty: number): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { error } = await (supabase.rpc as any)('rpc_delete_so_item', {
    p_item_id: itemId,
    p_org_id: ctx.orgId
  })

  if (error) return { error: error.message }

  // Total is updated by RPC
  revalidatePath(`/sales/${orderId}`)
  return {}
}

export async function updateOrderStatus(
  id: string, 
  status: "pending" | "paid" | "packing" | "shipped" | "delivered" | "cancelled",
  trackingInfo?: { tracking_number: string, courier: string }
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  // Fetch current status to enforce state machine
  const { data: currentOrder, error: fetchErr } = await supabase
    .from("sales_orders")
    .select("status")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (fetchErr || !currentOrder) {
    return { error: "Order not found" };
  }

  const currentStatus = currentOrder.status;

  // State Machine Guard
  // Allowed transitions:
  // pending -> paid, packing, shipped, cancelled
  // paid -> packing, shipped, cancelled
  // packing -> shipped, cancelled
  // shipped -> delivered
  // delivered -> (none)
  // cancelled -> (none)

  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return { error: `Cannot change status from ${currentStatus}` };
  }

  if (currentStatus === "shipped" && status !== "delivered") {
    return { error: `Cannot change status from shipped to ${status}` };
  }
  
  if (status === "pending" && currentStatus !== "pending") {
    return { error: "Cannot revert status back to pending" };
  }

  const updates: any = {}
  if (trackingInfo) {
    updates.tracking_number = trackingInfo.tracking_number
    updates.courier = trackingInfo.courier
  }

  if (status === "shipped") {
    const { error: rpcError } = await (supabase as any).rpc('rpc_ship_sales_order', {
      p_order_id: id,
      p_user_id: ctx.userId,
      p_org_id: ctx.orgId
    })
    if (rpcError) return { error: `Failed to ship order: ${rpcError.message || rpcError.details}` }
  } else if (status === "cancelled") {
    const { error: rpcError } = await (supabase as any).rpc('rpc_cancel_sales_order_reservation', {
      p_order_id: id,
      p_user_id: ctx.userId,
      p_org_id: ctx.orgId
    })
    if (rpcError) return { error: `Failed to cancel order: ${rpcError.message || rpcError.details}` }
  } else {
    updates.status = status
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("sales_orders").update(updates).eq("id", id).eq("org_id", ctx.orgId)
    if (error) return { error: error.message }
  }

  revalidatePath("/sales")
  revalidatePath(`/sales/${id}`)
  return {}
}
