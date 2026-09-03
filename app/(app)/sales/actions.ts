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
  
  const { data: order } = await supabase
    .from("sales_orders")
    .select("status")
    .eq("id", parsed.data.order_id)
    .eq("org_id", ctx.orgId)
    .single()

  if (order?.status !== "pending") {
    return { error: "Cannot modify items unless order is pending" }
  }

  const { error } = await supabase.from("sales_order_items").insert({
    org_id: ctx.orgId,
    order_id: parsed.data.order_id,
    product_id: parsed.data.product_id,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
  })

  if (error) return { error: error.message }

  // Allocation: Reserve stock in Finished Goods (or general)
  // For simplicity, we just find any location with stock or the first location and allocate it.
  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("id, allocated_quantity")
    .eq("product_id", parsed.data.product_id)
    .eq("org_id", ctx.orgId)
    .limit(1)
    .single()

  if (balances) {
    await supabase.from("inventory_balances").update({
      allocated_quantity: balances.allocated_quantity + parsed.data.quantity
    }).eq("id", balances.id)
  }

  await recalculateOrderTotal(parsed.data.order_id, ctx.orgId)
  revalidatePath(`/sales/${parsed.data.order_id}`)
  return {}
}

export async function deleteOrderItem(itemId: string, orderId: string, productId: string, qty: number): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { data: order } = await supabase.from("sales_orders").select("status").eq("id", orderId).eq("org_id", ctx.orgId).single()

  if (order?.status !== "pending") return { error: "Cannot modify items" }

  const { error } = await supabase.from("sales_order_items").delete().eq("id", itemId).eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  // De-allocate
  const { data: balances } = await supabase.from("inventory_balances").select("id, allocated_quantity").eq("product_id", productId).eq("org_id", ctx.orgId).limit(1).single()
  if (balances && balances.allocated_quantity >= qty) {
    await supabase.from("inventory_balances").update({
      allocated_quantity: balances.allocated_quantity - qty
    }).eq("id", balances.id)
  }

  await recalculateOrderTotal(orderId, ctx.orgId)
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
  
  const updates: any = { status }
  if (trackingInfo) {
    updates.tracking_number = trackingInfo.tracking_number
    updates.courier = trackingInfo.courier
  }

  // If status is shipped/delivered, we need to cut actual stock and remove allocation
  if (status === "shipped") {
    const { data: items } = await supabase.from("sales_order_items").select("product_id, quantity").eq("order_id", id).eq("org_id", ctx.orgId)
    if (items) {
      for (const item of items) {
        const { data: balances } = await supabase.from("inventory_balances").select("id, on_hand_quantity, allocated_quantity").eq("product_id", item.product_id).eq("org_id", ctx.orgId).limit(1).single()
        if (balances) {
          // Reduce on-hand AND allocated
          await supabase.from("inventory_balances").update({
            on_hand_quantity: Math.max(0, balances.on_hand_quantity - item.quantity),
            allocated_quantity: Math.max(0, balances.allocated_quantity - item.quantity)
          }).eq("id", balances.id)
        }
        
        // Also reduce global product stock
        const { data: p } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).eq("org_id", ctx.orgId).single()
        if (p) {
          await supabase.from("products").update({
            stock_quantity: Math.max(0, p.stock_quantity - item.quantity)
          }).eq("id", item.product_id)
        }
      }
    }
  }

  // If cancelled, return allocation
  if (status === "cancelled") {
    const { data: currentOrder } = await supabase.from("sales_orders").select("status").eq("id", id).single()
    if (currentOrder?.status !== "shipped" && currentOrder?.status !== "delivered") {
      const { data: items } = await supabase.from("sales_order_items").select("product_id, quantity").eq("order_id", id).eq("org_id", ctx.orgId)
      if (items) {
        for (const item of items) {
          const { data: balances } = await supabase.from("inventory_balances").select("id, allocated_quantity").eq("product_id", item.product_id).eq("org_id", ctx.orgId).limit(1).single()
          if (balances) {
            await supabase.from("inventory_balances").update({
              allocated_quantity: Math.max(0, balances.allocated_quantity - item.quantity)
            }).eq("id", balances.id)
          }
        }
      }
    }
  }

  const { error } = await supabase.from("sales_orders").update(updates).eq("id", id).eq("org_id", ctx.orgId)
  if (error) return { error: error.message }

  revalidatePath("/sales")
  revalidatePath(`/sales/${id}`)
  return {}
}
