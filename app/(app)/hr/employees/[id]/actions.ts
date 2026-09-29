"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgContext, requireRole } from "@/lib/auth"

const EMPLOYEE_ROLES = new Set([
  "staff",
  "foreman",
  "manager",
  "executive",
  "admin",
])

export async function updateEmployee(id: string, data: any) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการแก้ไขข้อมูลพนักงาน" }
  }

  if (!EMPLOYEE_ROLES.has(data.role)) {
    return { error: "Employee Role ไม่ถูกต้อง" }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from("employees")
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      nickname: data.nickname || null,
      position: data.position || null,
      department: data.department || null,
      daily_wage: data.daily_wage,
      employment_type: data.employment_type,
      role: data.role,
      shift_id: data.shift_id || null,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  if (data.balance) {
    const { error: balErr } = await supabase
      .from("leave_balances")
      .upsert(
        {
          org_id: ctx.orgId,
          employee_id: id,
          year: data.balance.year,
          sick_total: data.balance.sick_total,
          personal_total: data.balance.personal_total,
          vacation_total: data.balance.vacation_total,
          sick_used: data.balance.sick_used,
          personal_used: data.balance.personal_used,
          vacation_used: data.balance.vacation_used,
        },
        { onConflict: "employee_id, year" }
      )

    if (balErr) return { error: balErr.message }
  }

  revalidatePath("/hr/employees")
  revalidatePath(`/hr/employees/${id}`)
  revalidatePath("/team")

  return { success: true }
}

export async function linkEmployeeAccount(
  employeeId: string,
  userId: string
) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการผูกบัญชีผู้ใช้" }
  }

  const adminClient = createAdminClient()

  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (employeeError || !employee) {
    return { error: "ไม่พบ Employee Record ในองค์กรนี้" }
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (membershipError || !membership) {
    return { error: "บัญชีนี้ไม่ได้เป็นสมาชิกขององค์กรปัจจุบัน" }
  }

  if (membership.role === "owner" && ctx.role !== "owner") {
    return { error: "Admin ไม่สามารถจัดการบัญชี Owner ได้" }
  }

  if (employee.user_id && employee.user_id !== userId) {
    return {
      error: "Employee คนนี้ผูกกับบัญชีอื่นอยู่แล้ว กรุณา Unlink ก่อน",
    }
  }

  const { data: existingLink, error: existingLinkError } =
    await adminClient
      .from("employees")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId)
      .neq("id", employeeId)
      .maybeSingle()

  if (existingLinkError) {
    return { error: existingLinkError.message }
  }

  if (existingLink) {
    return {
      error: "บัญชีนี้ถูกผูกกับ Employee คนอื่นในองค์กรแล้ว",
    }
  }

  const { error } = await adminClient
    .from("employees")
    .update({ user_id: userId })
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/hr/employees")
  revalidatePath(`/hr/employees/${employeeId}`)
  revalidatePath("/team")

  return { success: true }
}

export async function unlinkEmployeeAccount(employeeId: string) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการยกเลิกการผูกบัญชี" }
  }

  const adminClient = createAdminClient()

  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (employeeError || !employee) {
    return { error: "ไม่พบ Employee Record ในองค์กรนี้" }
  }

  if (!employee.user_id) {
    return { success: true }
  }

  const { data: membership } = await adminClient
    .from("memberships")
    .select("role")
    .eq("user_id", employee.user_id)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (membership?.role === "owner" && ctx.role !== "owner") {
    return { error: "Admin ไม่สามารถจัดการบัญชี Owner ได้" }
  }

  const { error } = await adminClient
    .from("employees")
    .update({ user_id: null })
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/hr/employees")
  revalidatePath(`/hr/employees/${employeeId}`)
  revalidatePath("/team")

  return { success: true }
}

export async function offboardEmployee(
  employeeId: string
) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return {
      error:
        "ไม่มีสิทธิ์ในการปิดใช้งานพนักงาน",
    }
  }

  const supabase = await createClient()

  const { error } = await (supabase as any).rpc(
    "offboard_employee",
    {
      target_employee_id: employeeId,
    }
  )

  if (error) {
    const message = error.message || ""

    if (
      message.includes(
        "Owner cannot be offboarded from HR"
      )
    ) {
      return {
        error:
          "ไม่สามารถทำรายการลาออกให้บัญชี Owner ได้",
      }
    }

    if (
      message.includes(
        "Not authorized to offboard employee"
      )
    ) {
      return {
        error:
          "ไม่มีสิทธิ์ในการปิดใช้งานพนักงาน",
      }
    }

    if (message.includes("Employee not found")) {
      return {
        error: "ไม่พบพนักงานในองค์กรนี้",
      }
    }

    return { error: message }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/employees")
  revalidatePath(`/hr/employees/${employeeId}`)
  revalidatePath("/team")

  return { success: true }
}


export async function deleteEmployeePermanently(
  employeeId: string
) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return {
      error: "ไม่มีสิทธิ์ในการลบพนักงาน",
    }
  }

  const supabase = await createClient()

  const { error } = await (supabase as any).rpc(
    "delete_employee_if_safe",
    {
      target_employee_id: employeeId,
    }
  )

  if (error) {
    const message = error.message || ""

    if (
      message.includes("EMPLOYEE_LINKED_USER")
    ) {
      return {
        error:
          "พนักงานคนนี้ยังผูกบัญชี Login อยู่ กรุณายกเลิกการผูกบัญชีก่อนลบถาวร",
      }
    }

    if (
      message.includes("EMPLOYEE_HAS_HISTORY")
    ) {
      return {
        error:
          "พนักงานคนนี้มีประวัติวันลา/เวลาเข้างานแล้ว จึงลบถาวรไม่ได้ กรุณาใช้ ลาออก / ปิดใช้งาน แทน",
      }
    }

    if (
      message.includes(
        "Not authorized to delete employee"
      )
    ) {
      return {
        error: "ไม่มีสิทธิ์ในการลบพนักงาน",
      }
    }

    if (message.includes("Employee not found")) {
      return {
        error: "ไม่พบพนักงานในองค์กรนี้",
      }
    }

    return { error: message }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/employees")
  revalidatePath("/team")

  return { success: true }
}
