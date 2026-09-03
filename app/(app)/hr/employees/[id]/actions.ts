"use server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function updateEmployee(id: string, data: any) {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  
  const { error } = await supabase.from("employees").update({
    first_name: data.first_name,
    last_name: data.last_name,
    nickname: data.nickname || null,
    position: data.position || null,
    department: data.department || null,
    daily_wage: data.daily_wage,
    employment_type: data.employment_type,
    role: data.role,
    is_active: data.is_active,
    shift_id: data.shift_id || null
  }).eq("id", id).eq("org_id", ctx.orgId)

  if (error) return { error: error.message }
  
  if (data.balance) {
    const { error: balErr } = await supabase.from("leave_balances").upsert({
      org_id: ctx.orgId,
      employee_id: id,
      year: data.balance.year,
      sick_total: data.balance.sick_total,
      personal_total: data.balance.personal_total,
      vacation_total: data.balance.vacation_total,
      sick_used: data.balance.sick_used,
      personal_used: data.balance.personal_used,
      vacation_used: data.balance.vacation_used,
    }, { onConflict: 'employee_id, year' })
    if (balErr) return { error: balErr.message }
  }

  revalidatePath("/hr/employees")
  revalidatePath(`/hr/employees/${id}`)
  return { success: true }
}
