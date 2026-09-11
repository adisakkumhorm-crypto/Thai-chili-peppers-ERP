"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const QuotationSchema = z.object({
  pr_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  quotation_number: z.string().optional(),
  quotation_date: z.string().optional(),
  price: z.number().min(0),
  quantity: z.number().min(1),
  unit: z.string().optional(),
  lead_time: z.string().optional(),
  payment_term: z.string().optional(),
  valid_until: z.string().optional().nullable(),
  remark: z.string().optional(),
  attachment_url: z.string().optional(),
  status: z.enum(["draft", "received"]).default("draft")
})

export type CreateQuotationInput = z.infer<typeof QuotationSchema>

export async function addQuotation(input: CreateQuotationInput) {
  const ctx = await requireOrgContext()
  const parsed = QuotationSchema.safeParse(input)
  
  if (!parsed.success) return { error: "Invalid data." }
  
  const supabase = await createClient()
  const data = parsed.data

  const { error } = await supabase
    .from<any, any>("pr_quotations")
    .insert({
      org_id: ctx.orgId,
      pr_id: data.pr_id,
      supplier_id: data.supplier_id,
      quotation_number: data.quotation_number || null,
      quotation_date: data.quotation_date || null,
      price: data.price,
      quantity: data.quantity,
      unit: data.unit || null,
      lead_time: data.lead_time || null,
      payment_term: data.payment_term || null,
      valid_until: data.valid_until || null,
      remark: data.remark || null,
      attachment_url: data.attachment_url || null,
      status: data.status
    })

  if (error) return { error: error.message }

  // Update PR status to in_procurement if it's currently submitted
  const { data: pr } = await supabase.from("purchase_requests").select("status").eq("id", data.pr_id).single()
  if (pr?.status === 'submitted') {
    await supabase.from("purchase_requests").update({ status: 'in_procurement' }).eq("id", data.pr_id)
  }

  revalidatePath(`/purchases/requests/${data.pr_id}`)
  return { success: true }
}

export async function updateQuotation(id: string, input: Partial<CreateQuotationInput>) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  
  const { error } = await supabase
    .from<any, any>("pr_quotations")
    .update(input)
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }
  
  if (input.pr_id) {
    revalidatePath(`/purchases/requests/${input.pr_id}`)
  }
  return { success: true }
}

const SelectionSchema = z.object({
  pr_id: z.string().uuid(),
  quotation_id: z.string().uuid(),
  reason: z.string().min(1, "กรุณาระบุเหตุผลในการเลือก")
})

export type SelectQuotationInput = z.infer<typeof SelectionSchema>

export async function selectQuotationForPR(input: SelectQuotationInput) {
  const ctx = await requireOrgContext()
  const parsed = SelectionSchema.safeParse(input)
  
  if (!parsed.success) return { error: "Invalid data." }
  
  const supabase = await createClient()
  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) return { error: "Unauthorized" }

  const data = parsed.data

  // Update PR
  const { error: prError } = await supabase
    .from<any, any>("purchase_requests")
    .update({ 
      status: 'pending_approval',
      selected_quotation_id: data.quotation_id,
      selection_reason: data.reason,
      selected_by: authUser.user.id,
      selected_at: new Date().toISOString()
    })
    .eq("id", data.pr_id)
    .eq("org_id", ctx.orgId)

  if (prError) return { error: prError.message }

  // Update Selected Quotation
  const { error: qError } = await supabase
    .from<any, any>("pr_quotations")
    .update({ status: 'selected' })
    .eq("id", data.quotation_id)
    .eq("org_id", ctx.orgId)

  if (qError) {
    // Revert PR if needed, but assuming success for now
    return { error: qError.message }
  }

  // Update Others to rejected (optional but good for clarity)
  await supabase
    .from<any, any>("pr_quotations")
    .update({ status: 'rejected' })
    .eq("pr_id", data.pr_id)
    .neq("id", data.quotation_id)
    .eq("org_id", ctx.orgId)

  revalidatePath(`/purchases/requests/${data.pr_id}`)
  return { success: true }
}
