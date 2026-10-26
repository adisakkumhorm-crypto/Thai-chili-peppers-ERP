"use server"

import { revalidatePath } from "next/cache"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import {
  requireFeatureAccess,
  requireOrgContext,
} from "@/lib/auth"

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

type FaceTemplateRpcRow = {
  employee_id: string
  first_name: string
  last_name: string
  descriptor: unknown
}


function normalizeDescriptor(value: unknown): number[] | null {
  let candidate = value

  /*
   * Compatibility for any historical JSON-string representation.
   */
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return null
    }
  }

  if (
    !Array.isArray(candidate)
    || candidate.length !== 128
    || candidate.some(
      (item) =>
        typeof item !== "number"
        || !Number.isFinite(item)
    )
  ) {
    return null
  }

  return candidate
}


export async function getEmployeesForFaceScan() {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  /*
   * SECURITY-HR-001D-A:
   *
   * The database capability decides the visibility scope.
   *
   *   /hr      -> all enrolled active employees in this org
   *   /check-in -> caller's own linked employee only
   */
  const { data, error } = await supabase.rpc(
    "rpc_face_scan_templates",
    {
      p_org_id: ctx.orgId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  return (
    (data as FaceTemplateRpcRow[] | null) ?? []
  )
    .map((row) => {
      const descriptor =
        normalizeDescriptor(row.descriptor)

      if (!descriptor) {
        return null
      }

      /*
       * Preserve the client contract used by both existing face scanners.
       */
      return {
        id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        face_descriptor:
          JSON.stringify(descriptor),
      }
    })
    .filter(
      (
        row
      ): row is {
        id: string
        first_name: string
        last_name: string
        face_descriptor: string
      } => row !== null
    )
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
    return {
      error: error.message,
    }
  }

  const result =
    data as PunchResult

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

  /*
   * Defense in depth:
   * page guard + server-action guard + database capability.
   */
  requireFeatureAccess(ctx, "/hr")

  if (
    descriptor.length !== 128
    || descriptor.some(
      (value) =>
        typeof value !== "number"
        || !Number.isFinite(value)
    )
  ) {
    return {
      error: "Invalid face descriptor",
    }
  }

  const supabase =
    await createSupabaseClient()

  const { error } = await supabase.rpc(
    "rpc_set_face_template",
    {
      p_org_id: ctx.orgId,
      p_employee_id: employeeId,
      p_descriptor: descriptor,
    }
  )

  if (error) {
    return {
      error: error.message,
    }
  }

  revalidatePath("/hr")
  revalidatePath("/hr/employees")
  revalidatePath(
    `/hr/employees/${employeeId}/face`
  )

  return {
    success: true,
  }
}
