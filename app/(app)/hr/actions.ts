"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { redirect } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const EmployeeInput = z.object({
  employee_code: z.string().min(1, "Required"),
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  nickname: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  daily_wage: z.coerce.number().min(0),
  employment_type: z.enum(["monthly", "daily", "part_time"]).default("monthly"),
  qr_code: z.string().optional().nullable(),
  shift_id: z.string().optional().nullable(),
  role: z.enum(["admin", "foreman", "staff"]).default("staff"),
})

export async function createEmployee(input: z.infer<typeof EmployeeInput>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = EmployeeInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  
  // Check if Code already exists
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("employee_code", parsed.data.employee_code)
    .eq("org_id", ctx.orgId)
    .limit(1)
    
  if (existing && existing.length > 0) {
    return { error: "Employee Code already exists" }
  }

  const { error } = await supabase.from("employees").insert({
    org_id: ctx.orgId,
    employee_code: parsed.data.employee_code,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    nickname: parsed.data.nickname || null,
    position: parsed.data.position || null,
    department: parsed.data.department || null,
    daily_wage: parsed.data.daily_wage,
    employment_type: parsed.data.employment_type,
    qr_code: parsed.data.qr_code || null,
    role: parsed.data.role,
    shift_id: parsed.data.shift_id || null
  })

  if (error) return { error: error.message }
  
  revalidatePath("/hr")
  revalidatePath("/hr/employees")
  redirect("/hr/employees")
}
