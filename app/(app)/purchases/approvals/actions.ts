"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const ApproveSchema = z.object({
  pr_id: z.string().uuid()
})

const RejectSchema = z.object({
  pr_id: z.string().uuid(),
  reason: z.string().min(1, "กรุณาระบุเหตุผล")
})

async function checkApprovalEligibility(prId: string) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) throw new Error("Unauthorized")

  // Fetch PR
  const { data: pr } = await supabase
    .from<any, any>("purchase_requests")
    .select("*, pr_quotations!selected_quotation_id(price)")
    .eq("id", prId)
    .eq("org_id", ctx.orgId)
    .single()

  if (!pr) throw new Error("PR not found")
  if ((pr as any).status !== 'pending_approval') throw new Error("PR is not pending approval")
  if (!(pr as any).selected_quotation_id || !(pr as any).pr_quotations) throw new Error("PR has no selected quotation")
  
  if ((pr as any).requested_by === authUser.user.id) {
    throw new Error("You cannot approve your own PR")
  }

  const price = (pr as any).pr_quotations.price || 0

  // Check limits
  const { data: limits } = await supabase
    .from<any, any>("approval_limits")
    .select("*")
    .eq("user_id", authUser.user.id)
    .eq("org_id", ctx.orgId)

  const canApprove = limits?.some((l: any) => Number(l.max_amount) >= Number(price))
  
  // Also check if user is admin (owner)
  const { data: mem } = await supabase
    .from<any, any>("memberships")
    .select("role")
    .eq("org_id", ctx.orgId)
    .eq("user_id", authUser.user.id)
    .single()

  if (!canApprove && (mem as any)?.role !== 'owner' && (mem as any)?.role !== 'admin') {
    throw new Error("Approval limit exceeded or unauthorized")
  }

  return { pr, user: authUser.user, price }
}

async function logAudit(supabase: any, orgId: string, actorId: string, actorEmail: string, action: string, summary: string, meta: any = {}) {
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: actorId,
    actor_email: actorEmail,
    entity: "purchase_requests",
    entity_id: meta.pr_id,
    action,
    summary,
    meta
  })
}

export async function approvePR(input: z.infer<typeof ApproveSchema>) {
  try {
    const { pr, user, price } = await checkApprovalEligibility(input.pr_id)
    const ctx = await requireOrgContext()
    const supabase = await createClient()

    const { error } = await supabase
      .from<any, any>("purchase_requests")
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq("id", input.pr_id)

    if (error) return { error: error.message }

    await logAudit(supabase, ctx.orgId, user.id, user.email || "", "APPROVE_PR", `Approved PR ${(pr as any).pr_number}`, { pr_id: input.pr_id, price })

    revalidatePath(`/purchases/approvals/${input.pr_id}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function rejectPR(input: z.infer<typeof RejectSchema>) {
  try {
    const { pr, user } = await checkApprovalEligibility(input.pr_id)
    const ctx = await requireOrgContext()
    const supabase = await createClient()

    const { error } = await supabase
      .from<any, any>("purchase_requests")
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: input.reason
      })
      .eq("id", input.pr_id)

    if (error) return { error: error.message }

    await logAudit(supabase, ctx.orgId, user.id, user.email || "", "REJECT_PR", `Rejected PR ${(pr as any).pr_number}`, { pr_id: input.pr_id, reason: input.reason })

    revalidatePath(`/purchases/approvals/${input.pr_id}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function requestRevisionPR(input: z.infer<typeof RejectSchema>) {
  try {
    const { pr, user } = await checkApprovalEligibility(input.pr_id)
    const ctx = await requireOrgContext()
    const supabase = await createClient()

    const { error } = await supabase
      .from<any, any>("purchase_requests")
      .update({
        status: 'revision_requested',
        revision_requested_by: user.id,
        revision_requested_at: new Date().toISOString(),
        revision_reason: input.reason
      })
      .eq("id", input.pr_id)

    if (error) return { error: error.message }

    await logAudit(supabase, ctx.orgId, user.id, user.email || "", "REVISE_PR", `Requested revision for PR ${(pr as any).pr_number}`, { pr_id: input.pr_id, reason: input.reason })

    revalidatePath(`/purchases/approvals/${input.pr_id}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function generatePOFromPR(prId: string) {
  try {
    const ctx = await requireOrgContext()
    const supabase = await createClient()
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) throw new Error("Unauthorized")

    // Check permission - ensure user has procurement role or admin/owner
    const { data: mem } = await supabase
      .from<any, any>("memberships")
      .select("role")
      .eq("org_id", ctx.orgId)
      .eq("user_id", authUser.user.id)
      .single()
      
    const { data: emp } = await supabase
      .from<any, any>("employees")
      .select("role, department")
      .eq("org_id", ctx.orgId)
      .eq("user_id", authUser.user.id)
      .single()
      
    const isProcurement = (emp as any)?.department?.toLowerCase() === 'procurement' || 
                          (emp as any)?.role?.toLowerCase() === 'procurement' ||
                          (mem as any)?.role === 'owner' || 
                          (mem as any)?.role === 'admin'
                          
    if (!isProcurement) {
      throw new Error("You do not have permission to generate POs (Procurement access required)")
    }

    // Call RPC for Transaction Safety
    const { data: poId, error } = await (supabase.rpc as any)('generate_po_from_pr', {
      p_pr_id: prId,
      p_user_id: authUser.user.id
    })

    if (error) {
      throw new Error(error.message)
    }

    await logAudit(supabase, ctx.orgId, authUser.user.id, authUser.user.email || "", "GENERATE_PO", `Generated PO for PR`, { pr_id: prId, po_id: poId })

    revalidatePath(`/purchases/approvals/${prId}`)
    revalidatePath(`/purchases`)
    return { success: true, poId }
  } catch (err: any) {
    return { error: err.message }
  }
}
