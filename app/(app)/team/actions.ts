"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgContext, requireRole } from "@/lib/auth"

export async function processJoinRequest(input: {
  requestId: string
  action: 'approve' | 'reject'
  employeeOption?: 'new' | 'link'
  employeeId?: string
  employeeRole?: 'staff' | 'foreman' | 'manager' | 'executive' | 'admin'
  employeeCode?: string
  firstName?: string
  lastName?: string
  position?: string
  allowedFeatures?: string[]
}) {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "Only an owner or admin can process join requests." }
  }

  const adminClient = createAdminClient()

  const { data: rawReq, error: reqError } = await adminClient
    .from("join_requests" as any)
    .select("*")
    .eq("id", input.requestId)
    .single()

  const req = rawReq as any

  if (reqError || !req) {
    return { error: "Join request not found." }
  }

  if (input.action === 'reject') {
    const { error } = await adminClient
      .from("join_requests" as any)
      .update({ status: 'rejected' })
      .eq("id", input.requestId)
    if (error) return { error: error.message }
  } else {
    // Approve flow
    const { error: updateErr } = await adminClient
      .from("join_requests" as any)
      .update({ status: 'approved' })
      .eq("id", input.requestId)
    
    if (updateErr) return { error: updateErr.message }

    const { error: memErr } = await adminClient
      .from("memberships")
      .insert({
        org_id: req.org_id,
        user_id: req.user_id,
        role: "member" // default database role
      })

    if (memErr && memErr.code !== '23505') {
      console.error("Membership error:", memErr)
    }

    if (input.employeeOption === 'new') {
      const { error: empErr } = await adminClient
        .from("employees")
        .insert({
          org_id: req.org_id,
          user_id: req.user_id,
          employee_code: input.employeeCode || `EMP${Math.floor(Math.random() * 10000)}`,
          first_name: input.firstName || "New",
          last_name: input.lastName || "Employee",
          role: input.employeeRole as any,
          position: input.position || null,
          allowed_features: input.allowedFeatures || []
        } as any)
      if (empErr) console.error("Employee creation error:", empErr)
    } else if (input.employeeOption === 'link' && input.employeeId) {
      const { error: empErr } = await adminClient
        .from("employees")
        .update({
          user_id: req.user_id,
          role: input.employeeRole as any,
          allowed_features: input.allowedFeatures || []
        } as any)
        .eq("id", input.employeeId)
      if (empErr) console.error("Employee link error:", empErr)
    }
  }

  
  

  revalidatePath("/team")
  return { success: true }
}


export async function removeMember(input: { userId: string, orgId: string }) {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการทำรายการนี้" }
  }
  
  if (input.userId === ctx.userId) {
    return { error: "ไม่สามารถลบบัญชีของตัวเองได้" }
  }

  const adminClient = createAdminClient()

  // Prevent deleting owner
  const { data: targetMem } = await adminClient.from("memberships").select("role").eq("user_id", input.userId).eq("org_id", input.orgId).single()
  if (targetMem?.role === "owner" && ctx.role !== "owner") {
    return { error: "แอดมินไม่สามารถลบบัญชีเจ้าของระบบได้" }
  }

  // Delete employee record
  const { data: emp } = await adminClient
    .from("employees")
    .select("id")
    .eq("user_id", input.userId)
    .eq("org_id", input.orgId)
    .single()
    
  if (emp) {
    await adminClient.from("employees").delete().eq("id", emp.id)
  }

  // Delete membership
  const { error: memError } = await adminClient
    .from("memberships")
    .delete()
    .eq("user_id", input.userId)
    .eq("org_id", input.orgId)
    
  if (memError) return { error: memError.message }

  // Cleanup join request
  await adminClient
    .from("join_requests" as any)
    .delete()
    .eq("user_id", input.userId)
    .eq("org_id", input.orgId)

  // 🧹 ลบบัญชีผู้ใช้ออกจากระบบ Auth หลักด้วย เพื่อให้เขาใช้อีเมลเดิมสมัครใหม่ได้
  await adminClient.auth.admin.deleteUser(input.userId)

  revalidatePath("/team")
  return { success: true }
}

export async function updateMemberFeatures(input: {
  userId: string
  orgId: string
  employeeRole: string
  allowedFeatures: string[]
}) {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการทำรายการนี้" }
  }

  const adminClient = createAdminClient()

  const { data: emp } = await adminClient
    .from("employees")
    .select("id")
    .eq("user_id", input.userId)
    .eq("org_id", input.orgId)
    .single()

  
  if (emp) {
    const { error } = await adminClient
      .from("employees")
      .update({
        role: input.employeeRole as any,
        allowed_features: input.allowedFeatures
      } as any)
      .eq("id", emp.id)
    if (error) return { error: error.message }
  }

  // Also update memberships role
  const roleEnumMap: Record<string, string> = {
    staff: "member",
    foreman: "member",
    manager: "member",
    executive: "admin",
    admin: "admin",
    owner: "owner" // Should rarely change to owner, but just in case
  }
  
  const targetRole = roleEnumMap[input.employeeRole] || "member"

  revalidatePath("/team")
  return { success: true }
}

export async function updateUserPassword(input: { userId: string, newPassword: string }) {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการทำรายการนี้" }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(input.userId, {
    password: input.newPassword
  })

  if (error) return { error: error.message }

  return { success: true }
}
