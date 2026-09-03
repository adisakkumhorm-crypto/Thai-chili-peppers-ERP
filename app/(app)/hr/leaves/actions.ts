"use server"

import { revalidatePath } from "next/cache"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { calculateWorkingDays } from "@/lib/leave"

export async function updateLeaveStatus(requestId: string, status: "approved" | "rejected") {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/my-leave")
  
  const supabase = await createSupabaseClient()

  const { data: req } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", requestId)
    .eq("org_id", ctx.orgId)
    .single()
    
  if (!req) return { error: "Request not found" }
  if (req.status !== "pending") return { error: "Already processed" }

  const { error } = await supabase
    .from("leave_requests")
    .update({ 
      status, 
      approved_by: ctx.userId 
    })
    .eq("id", requestId)
    
  if (error) return { error: error.message }
  
  if (status === "approved" && !req.is_unpaid) {
    // 1. Fetch Org config
    const [{ data: org }, { data: hols }] = await Promise.all([
      supabase.from("organizations").select("working_days").eq("id", ctx.orgId).single(),
      supabase.from("public_holidays").select("date").eq("org_id", ctx.orgId)
    ])
    
    const workingDays = org?.working_days || [1,2,3,4,5]
    const holidays = (hols || []).map((h: any) => h.date)
    
    // 2. Calculate true leave days
    const days = calculateWorkingDays(req.start_date as string, req.end_date as string, workingDays, holidays)
    
    const year = new Date(req.start_date as string).getFullYear()
    
    const { data: bal } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("employee_id", req.employee_id)
      .eq("year", year)
      .single()
      
    const field = `${req.type}_used`
    if (bal) {
      await supabase
        .from("leave_balances")
        .update({ [field]: (bal as any)[field] + days } as any)
        .eq("id", bal.id)
    } else {
      // Create new balance record with defaults if it doesn't exist
      const defaultBalances: any = {
        employee_id: req.employee_id,
        org_id: ctx.orgId,
        year: year,
        sick_total: 30, sick_used: 0,
        personal_total: 6, personal_used: 0,
        vacation_total: 6, vacation_used: 0
      }
      defaultBalances[field] = days;
      await supabase.from("leave_balances").insert(defaultBalances)
    }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/leaves")
  revalidatePath("/hr/leave-balances")
  revalidatePath("/my-leave")
  return {}
}
