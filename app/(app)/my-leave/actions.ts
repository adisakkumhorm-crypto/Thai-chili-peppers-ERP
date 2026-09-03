"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import type { Enums } from "@/lib/types/database"
import { calculateWorkingDays } from "@/lib/leave"

const LeaveRequestInput = z.object({
  type: z.enum(["sick", "personal", "vacation"]),
  start_date: z.string().min(1, "Required"),
  end_date: z.string().min(1, "Required"),
  reason: z.string().optional().nullable(),
  is_unpaid: z.boolean().optional()
})


export async function createLeaveRequest(input: z.infer<typeof LeaveRequestInput>): Promise<{ error?: string, confirmUnpaid?: boolean, days?: number, remaining?: number }> {
  const ctx = await requireOrgContext()
  const parsed = LeaveRequestInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (!emp) return { error: "Employee profile not found. Please contact HR to link your account." }

  // 1. Fetch Organization working days & holidays
  const [{ data: org }, { data: hols }] = await Promise.all([
    supabase.from("organizations").select("working_days").eq("id", ctx.orgId).single(),
    supabase.from("public_holidays").select("date").eq("org_id", ctx.orgId)
  ])
  
  const workingDays = org?.working_days || [1,2,3,4,5] // default Mon-Fri
  const holidays = (hols || []).map((h: any) => h.date)
  
  // 2. Calculate true leave days
  const leaveDays = calculateWorkingDays(parsed.data.start_date, parsed.data.end_date, workingDays, holidays)
  
  if (leaveDays === 0) {
    return { error: "ช่วงเวลาที่เลือกเป็นวันหยุดอยู่แล้ว ไม่จำเป็นต้องลางานค่ะ" }
  }

  // 3. Check balance
  const currentYear = new Date(parsed.data.start_date).getFullYear()
  const { data: bal } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("year", currentYear)
    .maybeSingle()

  let is_unpaid = parsed.data.is_unpaid;
  
  if (bal) {
    const typeFieldTotal = `${parsed.data.type}_total` as keyof typeof bal
    const typeFieldUsed = `${parsed.data.type}_used` as keyof typeof bal
    const total = bal[typeFieldTotal] as number || 0
    const used = bal[typeFieldUsed] as number || 0
    const remaining = total - used
    
    if (leaveDays > remaining && !is_unpaid) {
      // Return to client to ask for confirmation
      return { 
        error: `โควตาวันลาไม่เพียงพอ (ต้องการ ${leaveDays} วัน แต่เหลือ ${remaining} วัน) คุณต้องการลางานแบบไม่รับค่าจ้าง (Unpaid Leave) หรือไม่?`,
        confirmUnpaid: true,
        days: leaveDays,
        remaining
      }
    }
  }

  // 4. Save Request
  const { error } = await supabase.from("leave_requests").insert({
    org_id: ctx.orgId,
    employee_id: emp.id,
    type: parsed.data.type as Enums<"leave_type">,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason || null,
    is_unpaid
  })

  if (error) return { error: error.message }
  
  revalidatePath("/my-leave")
  revalidatePath("/hr/leaves")
  return {}
}
