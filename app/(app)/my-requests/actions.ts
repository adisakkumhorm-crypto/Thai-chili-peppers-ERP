"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const PRItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  specification: z.string().optional(),
})

const PRSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
  required_date: z.string().optional().nullable(),
  estimated_budget: z.number().optional().nullable(),
  attachment_url: z.string().optional().nullable(),
  items: z.array(PRItemSchema).min(1),
})

export type CreatePRInput = z.infer<typeof PRSchema>

export async function checkInventoryForPR(orgId: string, productId: string) {
  const supabase = await createClient()
  const { data: balances } = (await supabase
    .from("inventory_balances")
    .select(`
      on_hand_quantity, 
      allocated_quantity,
      inventory_locations (
        id,
        name
      )
    `)
    .eq("org_id", orgId)
    .eq("product_id", productId)) as { data: any[] | null }

  let onHand = 0
  let allocated = 0
  const locations: any[] = []

  if (balances && balances.length > 0) {
    for (const b of balances) {
      const locOnHand = b.on_hand_quantity || 0
      const locAllocated = b.allocated_quantity || 0
      const locAvailable = Math.max(0, locOnHand - locAllocated)
      const locName = b.inventory_locations?.name || "Unknown Location"
      
      onHand += locOnHand
      allocated += locAllocated
      
      locations.push({
        locationName: locName,
        onHand: locOnHand,
        allocated: locAllocated,
        available: locAvailable
      })
    }
  }

  const available = Math.max(0, onHand - allocated)
  
  return { onHand, allocated, available, locations }
}

export async function getProductInventoryAction(productId: string) {
  const ctx = await requireOrgContext()
  return checkInventoryForPR(ctx.orgId, productId)
}

export async function createPurchaseRequest(input: CreatePRInput) {
  const ctx = await requireOrgContext()
  const parsed = PRSchema.safeParse(input)
  
  if (!parsed.success) return { error: "Invalid data." }
  
  const supabase = await createClient()
  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) return { error: "Unauthorized" }

  const data = parsed.data

  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "")
  const { count } = await supabase
    .from("purchase_requests")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ctx.orgId)
    .ilike("pr_number", `PR-${yearMonth}-%`)
    
  const seq = (count || 0) + 1
  const prNumber = `PR-${yearMonth}-${seq.toString().padStart(4, "0")}`

  const { data: pr, error: prError } = await supabase
    .from("purchase_requests")
    .insert({
      org_id: ctx.orgId,
      pr_number: prNumber,
      requested_by: authUser.user.id,
      project_id: data.project_id || null,
      reason: data.reason,
      required_date: data.required_date || null,
      estimated_budget: data.estimated_budget || null,
      attachment_url: data.attachment_url || null,
      status: 'submitted'
    })
    .select("id").single() as any

  if (prError) return { error: prError.message }

  const prItems = await Promise.all(data.items.map(async (item) => {
    const inv = await checkInventoryForPR(ctx.orgId, item.product_id)
    const required = item.quantity
    const available = inv.available
    
    let suggested = 0
    let shortage = 0
    
    if (available >= required) {
      suggested = required
      shortage = 0
    } else {
      suggested = available
      shortage = required - available
    }

    return {
      org_id: ctx.orgId,
      pr_id: pr.id,
      product_id: item.product_id,
      quantity: required,
      unit: item.unit,
      specification: item.specification,
      on_hand_at_request: inv.onHand,
      allocated_at_request: inv.allocated,
      available_at_request: available,
      suggested_stock_usage: suggested,
      purchase_shortage: shortage
    }
  }))

  const { error: itemsError } = await supabase
    .from("purchase_request_items")
    .insert(prItems)

  if (itemsError) {
    await supabase.from("purchase_requests").delete().eq("id", pr.id)
    return { error: itemsError.message }
  }

  revalidatePath("/my-requests")
  return { success: true, prId: pr.id }
}
