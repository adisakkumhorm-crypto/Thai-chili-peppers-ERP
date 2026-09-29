"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
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

  if (req.org_id !== ctx.orgId) {
    return { error: "Join request does not belong to this organization." }
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

  if (input.orgId !== ctx.orgId) {
    return { error: "องค์กรเป้าหมายไม่ตรงกับองค์กรปัจจุบัน" }
  }
  
  if (input.userId === ctx.userId) {
    return { error: "ไม่สามารถลบบัญชีของตัวเองได้" }
  }

  const adminClient = createAdminClient()

  // Prevent deleting owner
  const { data: targetMem } = await adminClient.from("memberships").select("role").eq("user_id", input.userId).eq("org_id", ctx.orgId).single()
  if (targetMem?.role === "owner" && ctx.role !== "owner") {
    return { error: "แอดมินไม่สามารถลบบัญชีเจ้าของระบบได้" }
  }

  // Delete employee record
  const { data: emp } = await adminClient
    .from("employees")
    .select("id")
    .eq("user_id", input.userId)
    .eq("org_id", ctx.orgId)
    .single()
    
  if (emp) {
    await adminClient.from("employees").delete().eq("id", emp.id)
  }

  // Delete membership
  const { error: memError } = await adminClient
    .from("memberships")
    .delete()
    .eq("user_id", input.userId)
    .eq("org_id", ctx.orgId)
    
  if (memError) return { error: memError.message }

  // Cleanup join request
  await adminClient
    .from("join_requests" as any)
    .delete()
    .eq("user_id", input.userId)
    .eq("org_id", ctx.orgId)

  // Delete the global Auth account only if this user has no memberships left.
  // This prevents removing a user from one organization from deleting access
  // to another organization.
  const { count: remainingMemberships } = await adminClient
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", input.userId)

  if ((remainingMemberships ?? 0) === 0) {
    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(input.userId)

    if (deleteUserError) {
      return { error: deleteUserError.message }
    }
  }

  revalidatePath("/team")
  return { success: true }
}

export async function updateMemberAccess(input: {
  userId: string
  orgId: string
  membershipRole: "owner" | "admin" | "member" | null
  employeeRole: "staff" | "foreman" | "manager" | "executive" | "admin" | null
  allowedFeatures: string[] | null
}) {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "ไม่มีสิทธิ์ในการทำรายการนี้" }
  }

  if (input.orgId !== ctx.orgId) {
    return { error: "องค์กรเป้าหมายไม่ตรงกับองค์กรปัจจุบัน" }
  }

  const membershipRoles = new Set(["owner", "admin", "member"])
  const employeeRoles = new Set([
    "staff",
    "foreman",
    "manager",
    "executive",
    "admin",
  ])

  if (
    input.membershipRole !== null &&
    !membershipRoles.has(input.membershipRole)
  ) {
    return { error: "Membership role ไม่ถูกต้อง" }
  }

  if (
    input.employeeRole !== null &&
    !employeeRoles.has(input.employeeRole)
  ) {
    return { error: "Employee role ไม่ถูกต้อง" }
  }

  if (
    input.allowedFeatures !== null &&
    (!Array.isArray(input.allowedFeatures) ||
      !input.allowedFeatures.every((item) => typeof item === "string"))
  ) {
    return { error: "Feature permissions ไม่ถูกต้อง" }
  }

  // IMPORTANT:
  // Use the session-bound server client so auth.uid() inside the RPC
  // is the real signed-in user. Do not use the service-role client here.
  const supabase = await createClient()

  const { error } = await (supabase as any).rpc("update_member_access", {
    target_user_id: input.userId,
    org_id: input.orgId,
    new_membership_role: input.membershipRole,
    new_employee_role: input.employeeRole,
    new_features: input.allowedFeatures,
  })

  if (error) {
    return { error: error.message }
  }

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

  const { data: targetMembership, error: membershipError } = await adminClient
    .from("memberships")
    .select("role")
    .eq("user_id", input.userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (membershipError || !targetMembership) {
    return { error: "ไม่พบบัญชีนี้ในองค์กรปัจจุบัน" }
  }

  if (targetMembership.role === "owner" && ctx.role !== "owner") {
    return { error: "แอดมินไม่สามารถรีเซ็ตรหัสผ่านของเจ้าของระบบได้" }
  }
  const { error } = await adminClient.auth.admin.updateUserById(input.userId, {
    password: input.newPassword
  })

  if (error) return { error: error.message }

  return { success: true }
}
