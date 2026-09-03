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

export async function processMobileCheckIn(input: z.infer<typeof CheckInInput>) {
  const ctx = await requireOrgContext()
  const parsed = CheckInInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()

  // 1. Get employee ID linked to current user
  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (!emp) return { error: "Employee profile not found. Contact HR." }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  
  const locData = parsed.data.lat && parsed.data.lng ? { lat: parsed.data.lat, lng: parsed.data.lng } : null

  // 2. Find today's timesheet
  const { data: ts } = await supabase
    .from("timesheets")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("work_date", today)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (parsed.data.actionType === "check_in") {
    if (ts && ts.check_in) {
      return { error: "คุณได้ทำการเข้างานไปแล้วในวันนี้" }
    }
    
    
    // Calculate if late (after 08:30 AM Bangkok time)
    const bkkTime = new Date(new Date(now).toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
    const h = bkkTime.getHours();
    const m = bkkTime.getMinutes();
    const isLate = h > 8 || (h === 8 && m > 30);
    const lateMinutes = isLate ? ((h - 8) * 60 + m - 30) : 0;
    
    const { error } = await supabase.from("timesheets").insert({
      org_id: ctx.orgId,
      employee_id: emp.id,
      project_id: parsed.data.projectId || null,
      work_date: today,
      check_in: now,
      check_in_photo: parsed.data.photoUrl || null,
      check_in_location: locData as any,
      is_late: isLate,
      late_minutes: Math.max(0, lateMinutes),
      status: "working"
    })
    
    if (error) return { error: error.message }
    
    revalidatePath("/check-in")
    revalidatePath("/hr")
    return { success: true, message: "บันทึกเวลาเข้างานเรียบร้อยแล้ว!" }
    
  } else {
    // Check out
    if (!ts || !ts.check_in) {
      return { error: "ไม่พบข้อมูลเข้างานในวันนี้" }
    }
    if (ts.check_out) {
      return { error: "คุณได้ทำการออกงานไปแล้ว" }
    }

    const checkInTime = new Date(ts.check_in as string).getTime()
    const checkOutTime = new Date(now).getTime()
    const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60)
    
    // หักเวลาพัก 1 ชั่วโมง หากทำงานเกิน 5 ชั่วโมง (ตามกฎหมายแรงงาน)
    const effectiveHours = hoursDiff > 5 ? hoursDiff - 1 : hoursDiff;
    
    const regular_hours = Math.min(8, effectiveHours);
    const ot_hours = Math.max(0, effectiveHours - 8);
    const ot_multiplier = 1.5; // ค่าเริ่มต้น (ทำ OT วันธรรมดา)
    
    const hourlyRate = emp.daily_wage / 8;
    const wageAmount = (regular_hours * hourlyRate) + (ot_hours * hourlyRate * ot_multiplier);
    
    const { error } = await supabase.from("timesheets").update({
      check_out: now,
      check_out_photo: parsed.data.photoUrl || null,
      check_out_location: locData as any,
      regular_hours: Number(regular_hours.toFixed(2)),
      ot_hours: Number(ot_hours.toFixed(2)),
      ot_multiplier: ot_multiplier,
      wage_amount: Number(wageAmount.toFixed(2)),
      status: "completed"
    }).eq("id", ts.id)
    
    if (error) return { error: error.message }
    
    revalidatePath("/check-in")
    revalidatePath("/hr")
    return { success: true, message: `บันทึกเวลาออกงานเรียบร้อย! (${hoursDiff.toFixed(2)} ชั่วโมง)` }
  }
}
