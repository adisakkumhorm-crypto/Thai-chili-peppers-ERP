"use server"

import { revalidatePath } from "next/cache"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

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
  location: any | null,
  intent?: "check_in" | "check_out"
) {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()

  // 1. Find employee
  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    .single()

  if (!emp) return { error: "Employee not found" }

  const today = new Date().toISOString().split('T')[0]

  // 2. Find today's timesheet
  const { data: ts } = await supabase
    .from("timesheets")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("work_date", today)
    .eq("org_id", ctx.orgId)
    .single()

  if (!ts) {
    // Check In
    if (intent === "check_out") return { error: "ยังไม่ได้เข้างานในวันนี้ กรุณาเลือกเมนูเข้างาน" }
    
    const { error } = await supabase.from("timesheets").insert({
      org_id: ctx.orgId,
      employee_id: emp.id,
      project_id: projectId || null,
      work_date: today,
      check_in: new Date().toISOString(),
      status: "working",
      check_in_photo: photoPath,
      check_in_location: location
    })
    if (error) return { error: error.message }
    
    revalidatePath("/hr")
    revalidatePath("/projects")
    return { success: true, action: "check_in", employeeName: emp.first_name }
  } else if (!ts.check_out) {
    // Check Out
    if (intent === "check_in") return { error: "คุณได้บันทึกเข้างานไปแล้ว กรุณาเลือกเมนูออกงาน" }
    
    const checkInTime = new Date(ts.check_in as string).getTime()
    const checkOutTime = new Date().getTime()
    const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60)
    
    // หักเวลาพัก 1 ชั่วโมง หากทำงานเกิน 5 ชั่วโมง (ตามกฎหมายแรงงาน)
    const effectiveHours = hoursDiff > 5 ? hoursDiff - 1 : hoursDiff;
    
    const regular_hours = Math.min(8, effectiveHours);
    const ot_hours = Math.max(0, effectiveHours - 8);
    const ot_multiplier = 1.5; // ค่าเริ่มต้น (ทำ OT วันธรรมดา)
    
    const hourlyRate = emp.daily_wage / 8;
    const wageAmount = (regular_hours * hourlyRate) + (ot_hours * hourlyRate * ot_multiplier);
    
    const { error } = await supabase.from("timesheets").update({
      check_out: new Date().toISOString(),
      regular_hours: Number(regular_hours.toFixed(2)),
      ot_hours: Number(ot_hours.toFixed(2)),
      ot_multiplier: ot_multiplier,
      wage_amount: Number(wageAmount.toFixed(2)),
      status: "completed",
      check_out_photo: photoPath,
      check_out_location: location
    }).eq("id", ts.id)
    
    if (error) return { error: error.message }
    
    revalidatePath("/hr")
    revalidatePath("/projects")
    return { success: true, action: "check_out", employeeName: emp.first_name, hours: hoursDiff.toFixed(2) }
  } else {
    return { error: "Already checked out today" }
  }
}

export async function updateFaceDescriptor(employeeId: string, descriptor: number[]) {
  const ctx = await requireOrgContext()
  const supabase = await createSupabaseClient()
  
  const { error } = await supabase
    .from("employees")
    .update({ face_descriptor: JSON.stringify(descriptor) } as any)
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    
  if (error) return { error: error.message }
  revalidatePath("/hr")
  revalidatePath("/hr/employees")
  return { success: true }
}
