"use server"

import { revalidatePath } from "next/cache"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import {
  requireFeatureAccess,
  requireOrgContext,
} from "@/lib/auth"

const ALLOWED_OT_MULTIPLIERS = [1, 1.5, 2, 3]

export async function updateOTMultiplier(
  timesheetId: string,
  multiplier: number
) {
  const ctx = await requireOrgContext()

  /*
   * Application guard mirrors the database capability guard.
   * Database RPC remains authoritative.
   */
  requireFeatureAccess(ctx, "/hr")

  if (
    !Number.isFinite(multiplier) ||
    !ALLOWED_OT_MULTIPLIERS.includes(multiplier)
  ) {
    return { error: "Invalid OT multiplier" }
  }

  const supabase = await createSupabaseClient()

  const { error } = await supabase.rpc(
    "rpc_update_timesheet_ot_multiplier",
    {
      p_org_id: ctx.orgId,
      p_timesheet_id: timesheetId,
      p_multiplier: multiplier,
    }
  )

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/hr/timesheets")
  revalidatePath("/hr/payroll")

  return { success: true }
}
