"use server"

import { revalidatePath } from "next/cache"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

export async function updateOTMultiplier(timesheetId: string, multiplier: number) {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  // Fetch timesheet + employee to get daily wage
  const { data: ts } = await supabase
    .from("timesheets")
    .select("*, employees(daily_wage)")
    .eq("id", timesheetId)
    .eq("org_id", ctx.orgId)
    .single()

  if (!ts || !ts.employees) return { error: "Timesheet not found" }

  const dailyWage = ts.employees.daily_wage || 0
  const hourlyRate = dailyWage / 8
  const regular_hours = ts.regular_hours || 0
  const ot_hours = ts.ot_hours || 0

  const wageAmount = (regular_hours * hourlyRate) + (ot_hours * hourlyRate * multiplier)

  const { error } = await supabase
    .from("timesheets")
    .update({
      ot_multiplier: multiplier,
      wage_amount: Number(wageAmount.toFixed(2))
    })
    .eq("id", timesheetId)

  if (error) return { error: error.message }

  revalidatePath("/hr/timesheets")
  revalidatePath("/hr/payroll")
  return { success: true }
}
