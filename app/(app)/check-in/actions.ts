"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

const CheckInInput = z.object({
  actionType: z.enum(["check_in", "check_out"]),
  projectId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
})

export async function processMobileCheckIn(
  input: z.infer<typeof CheckInInput>
) {
  const ctx = await requireOrgContext()

  const parsed = CheckInInput.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabase = await createSupabaseClient()

  const location =
    parsed.data.lat != null && parsed.data.lng != null
      ? {
          lat: parsed.data.lat,
          lng: parsed.data.lng,
        }
      : null

  const { data, error } = await supabase.rpc(
    "rpc_timesheet_punch",
    {
      p_org_id: ctx.orgId,
      p_intent: parsed.data.actionType,
      p_employee_id: null,
      p_project_id: parsed.data.projectId || null,
      p_photo_path: parsed.data.photoUrl || null,
      p_location: location,
    }
  )

  if (error) {
    return { error: error.message }
  }

  const result = data as {
    action?: "check_in" | "check_out"
    hours?: number
  } | null

  revalidatePath("/check-in")
  revalidatePath("/hr")
  revalidatePath("/hr/timesheets")
  revalidatePath("/hr/payroll")

  if (result?.action === "check_out") {
    return {
      success: true,
      message:
        `บันทึกเวลาออกงานเรียบร้อย! ` +
        `(${Number(result.hours || 0).toFixed(2)} ชั่วโมง)`,
    }
  }

  return {
    success: true,
    message: "บันทึกเวลาเข้างานเรียบร้อยแล้ว!",
  }
}
