"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgContext, requireRole } from "@/lib/auth"
import { bahtToSatang } from "@/lib/money"
import { writeAudit } from "@/lib/audit"

const UpdateOrgSettings = z.object({
  orgName: z.string().min(1, "Workspace name is required"),
  cashBalanceBaht: z.coerce.number().min(0, "Cannot be negative"),
  monthlyBurnBaht: z.coerce.number().min(0, "Cannot be negative").optional(),
  timezone: z.string().default("Asia/Bangkok"),
})

export type UpdateOrgSettingsInput = z.infer<typeof UpdateOrgSettings>

export async function updateOrgSettings(
  input: UpdateOrgSettingsInput
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()

  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "Only an owner or admin can update settings." }
  }

  const parsed = UpdateOrgSettings.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { orgName, cashBalanceBaht, monthlyBurnBaht, timezone } = parsed.data

  const supabase = await createClient()

  const { error: settingsError } = await supabase.from("org_settings").upsert(
    {
      org_id: ctx.orgId,
      cash_balance_satang: bahtToSatang(cashBalanceBaht),
      monthly_burn_satang:
        monthlyBurnBaht === undefined || Number.isNaN(monthlyBurnBaht)
          ? null
          : bahtToSatang(monthlyBurnBaht),
    },
    { onConflict: "org_id" }
  )
  if (settingsError) return { error: settingsError.message }

  const { error: orgError } = await supabase
    .from("organizations")
    .update({ name: orgName, timezone: timezone })
    .eq("id", ctx.orgId)
  if (orgError) return { error: orgError.message }

  await writeAudit(ctx, {
    entity: "settings",
    entityId: ctx.orgId,
    action: "updated",
    summary: "Updated workspace settings",
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return {}
}

export async function processJoinRequest(input: {
  requestId: string
  action: 'approve' | 'reject'
  employeeOption?: 'new' | 'link'
  employeeId?: string
  employeeRole?: 'staff' | 'foreman' | 'admin'
  employeeCode?: string
  firstName?: string
  lastName?: string
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
        role: "member"
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
          role: input.employeeRole || 'staff'
        })
      if (empErr) console.error("Employee creation error:", empErr)
    } else if (input.employeeOption === 'link' && input.employeeId) {
      const { error: empErr } = await adminClient
        .from("employees")
        .update({
          user_id: req.user_id,
          role: input.employeeRole || 'staff'
        })
        .eq("id", input.employeeId)
      if (empErr) console.error("Employee link error:", empErr)
    }
  }

  revalidatePath("/settings")
  return { success: true }
}
