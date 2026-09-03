"use server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"

export async function updateWorkingDays(days: number[]) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  await supabase.from("organizations").update({ working_days: days }).eq("id", ctx.orgId)
  revalidatePath("/settings/hr")
  revalidatePath("/my-leave")
  return { success: true }
}

export async function addPublicHoliday(date: string, name: string) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  const { error } = await supabase.from("public_holidays").insert({
    org_id: ctx.orgId,
    date,
    name
  })
  if (error) return { error: error.message }
  revalidatePath("/settings/hr")
  revalidatePath("/my-leave")
  return { success: true }
}

export async function deletePublicHoliday(id: string) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  await supabase.from("public_holidays").delete().eq("id", id).eq("org_id", ctx.orgId)
  revalidatePath("/settings/hr")
  revalidatePath("/my-leave")
  return { success: true }
}

export async function updatePayrollSettings(otRate: number, latePenalty: number) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  await supabase.from("organizations").update({ 
    ot_rate_per_hour: otRate, 
    late_penalty_per_minute: latePenalty 
  }).eq("id", ctx.orgId)
  revalidatePath("/settings/hr")
  revalidatePath("/hr/payroll")
  return { success: true }
}

export async function createShift(name: string, startTime: string, endTime: string, breakMinutes: number) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  const { error } = await supabase.from("shifts" as any).insert({
    org_id: ctx.orgId,
    name,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes
  })
  if (error) return { error: error.message }
  revalidatePath("/settings/hr")
  return { success: true }
}

export async function deleteShift(id: string) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  const { error } = await supabase.from("shifts" as any).delete().eq("id", id).eq("org_id", ctx.orgId)
  if (error) return { error: error.message }
  revalidatePath("/settings/hr")
  return { success: true }
}
