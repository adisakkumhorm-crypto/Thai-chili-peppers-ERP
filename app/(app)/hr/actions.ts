"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { redirect } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"

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
  role: z.enum(["admin", "executive", "manager", "foreman", "staff"]).default("staff"),
})

export async function createEmployee(
  input: z.infer<typeof EmployeeInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการเพิ่มพนักงาน" }
  }

  const parsed = EmployeeInput.safeParse(input)

  if (!parsed.success) {
    return { error: "ข้อมูลพนักงานไม่ถูกต้อง" }
  }

  const employeeCode =
    parsed.data.employee_code.trim().toUpperCase()

  if (!employeeCode) {
    return { error: "กรุณาระบุรหัสพนักงาน" }
  }

  const supabase = await createSupabaseClient()

  const { error } = await supabase
    .from("employees")
    .insert({
      org_id: ctx.orgId,
      employee_code: employeeCode,
      first_name: parsed.data.first_name.trim(),
      last_name: parsed.data.last_name.trim(),
      nickname: parsed.data.nickname?.trim() || null,
      position: parsed.data.position?.trim() || null,
      department: parsed.data.department?.trim() || null,
      daily_wage: parsed.data.daily_wage,
      employment_type: parsed.data.employment_type,
      qr_code: parsed.data.qr_code?.trim() || null,
      role: parsed.data.role,
      shift_id: parsed.data.shift_id || null,
    })

  if (error) {
    if (
      error.code === "23505" ||
      error.message.includes(
        "employees_org_employee_code_uniq"
      )
    ) {
      return {
        error: `รหัสพนักงาน ${employeeCode} มีอยู่แล้ว`,
      }
    }

    console.error("Employee creation error:", {
      code: error.code,
      message: error.message,
      details: error.details,
    })

    return {
      error:
        "ไม่สามารถสร้างพนักงานได้ กรุณาลองใหม่อีกครั้ง",
    }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/employees")

  redirect("/hr/employees")
}
