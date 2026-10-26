"use server"

import { revalidatePath } from "next/cache"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

type PunchLocation = {
  lat: number
  lng: number
} | null

type PunchResult = {
  success?: boolean
  action?: "check_in" | "check_out"
  employeeName?: string
  hours?: number
} | null

export async function getEmployeesForFaceScan() {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  const { data } = await supabase
    .from("employees")
    .select("id, first_name, last_name, face_descriptor")
    .eq("org_id", ctx.orgId)
    .not("face_descriptor", "is", null)

  return data || []
}

export async function processFaceCheckIn(
  employeeId: string,
  projectId: string | null,
  photoPath: string | null,
  location: PunchLocation,
  intent?: "check_in" | "check_out"
) {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  /*
   * SECURITY-HR-001C:
   *
   * The RPC is the authority boundary.
   *
   * Ordinary user:
   *   employeeId must resolve to the employee linked to auth.uid().
   *
   * HR actor:
   *   /hr authority may punch for another employee (kiosk flow).
   */
  const { data, error } = await supabase.rpc(
    "rpc_timesheet_punch",
    {
      p_org_id: ctx.orgId,
      p_intent: intent || "auto",
      p_employee_id: employeeId,
      p_project_id: projectId || null,
      p_photo_path: photoPath,
      p_location: location,
    }
  )

  if (error) {
    return { error: error.message }
  }

  const result = data as PunchResult

  revalidatePath("/check-in")
  revalidatePath("/hr")
  revalidatePath("/hr/timesheets")
  revalidatePath("/hr/payroll")
  revalidatePath("/projects")

  return {
    success: true,
    action: result?.action,
    employeeName: result?.employeeName,
    hours:
      result?.hours == null
        ? undefined
        : Number(result.hours).toFixed(2),
  }
}

export async function updateFaceDescriptor(
  employeeId: string,
  descriptor: number[]
) {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  /*
   * Face enrollment authorization is intentionally handled separately
   * by SECURITY-HR-001D.
   */
  const { error } = await supabase
    .from("employees")
    .update({
      face_descriptor: JSON.stringify(descriptor),
    })
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/employees")

  return { success: true }
}
