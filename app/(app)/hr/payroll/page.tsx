import Link from "next/link"
import { ArrowLeft, Banknote, Download, FileSpreadsheet } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatTHB } from "@/lib/money"
import { calculateWorkingDays } from "@/lib/leave"

export const dynamic = "force-dynamic"

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/hr/payroll")
  
  const supabase = await createClient()
  
  const resolvedParams = await searchParams
  const now = new Date()
  const year = parseInt(resolvedParams.year || now.getFullYear().toString())
  const month = parseInt(resolvedParams.month || (now.getMonth() + 1).toString())
  
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`

  const [empsRes, tsRes, leavesRes, orgRes, holsRes] = await Promise.all([
    supabase.from("employees").select("*").eq("org_id", ctx.orgId).eq("is_active", true),
    supabase.from("timesheets").select("*").eq("org_id", ctx.orgId).eq("status", "completed").gte("work_date", startDate).lte("work_date", endDate),
    supabase.from("leave_requests").select("*").eq("org_id", ctx.orgId).eq("status", "approved").gte("start_date", startDate).lte("end_date", endDate),
    supabase.from("organizations").select("working_days, ot_rate_per_hour, late_penalty_per_minute").eq("id", ctx.orgId).single(),
    supabase.from("public_holidays").select("date").eq("org_id", ctx.orgId)
  ])

  const employees = empsRes.data ?? []
  const timesheets = tsRes.data ?? []
  const leaves = leavesRes.data ?? []
  const workingDaysConfig = orgRes.data?.working_days || [1,2,3,4,5]
  const holidays = (holsRes.data || []).map(h => h.date)
  
  const otRate = Number(orgRes.data?.ot_rate_per_hour || 0)
  const latePenalty = Number(orgRes.data?.late_penalty_per_minute || 0)

  const payrollData = employees.map(emp => {
    const empTs = timesheets.filter(t => t.employee_id === emp.id)
    const empLeaves = leaves.filter(l => l.employee_id === emp.id)
    
    const totalWorkDays = empTs.length
    const totalOTHours = empTs.reduce((acc, t) => acc + Number(t.ot_hours || 0), 0)
    const totalLateMins = empTs.reduce((acc, t) => acc + Number(t.late_minutes || 0), 0)
    
    let paidLeaveDays = 0
    let unpaidLeaveDays = 0

    empLeaves.forEach(l => {
      // Calculate true leave days overlapping this month
      const lStart = new Date(l.start_date)
      const lEnd = new Date(l.end_date)
      const mStart = new Date(startDate)
      const mEnd = new Date(endDate)
      
      const actualStart = lStart < mStart ? mStart : lStart
      const actualEnd = lEnd > mEnd ? mEnd : lEnd
      
      if (actualStart <= actualEnd) {
        const actualStartStr = actualStart.toISOString().split('T')[0]
        const actualEndStr = actualEnd.toISOString().split('T')[0]
        const days = calculateWorkingDays(actualStartStr, actualEndStr, workingDaysConfig, holidays)
        if (l.is_unpaid) {
          unpaidLeaveDays += days
        } else {
          paidLeaveDays += days
        }
      }
    })

    const lateAmount = totalLateMins * latePenalty
    
    let baseWage = 0
    let leaveDeduction = 0
    let isMonthly = emp.employment_type === 'monthly'
    
    if (isMonthly) {
      baseWage = Number(emp.daily_wage) // it's actually monthly salary
      // Deduct unpaid leave (Standard: Base / 30 * unpaid days)
      leaveDeduction = (baseWage / 30) * unpaidLeaveDays
    } else {
      // Daily or Part-time
      const dailyRate = Number(emp.daily_wage)
      baseWage = dailyRate * (totalWorkDays + paidLeaveDays)
    }

    // คำนวณ OT ตามกฎหมายแรงงาน
    const hourlyRate = isMonthly ? (Number(emp.daily_wage) / 30 / 8) : (Number(emp.daily_wage) / 8)
    let otAmount = 0
    empTs.forEach(t => {
      const hours = Number(t.ot_hours || 0)
      const multiplier = Number(t.ot_multiplier || 1.5) // Default 1.5
      otAmount += (hourlyRate * multiplier * hours)
    })

    const finalEstimatedWage = baseWage + otAmount - lateAmount - leaveDeduction

    return {
      ...emp,
      totalWorkDays,
      totalOTHours,
      totalLateMins,
      paidLeaveDays,
      unpaidLeaveDays,
      otAmount,
      lateAmount,
      leaveDeduction,
      baseWage,
      finalEstimatedWage: Math.max(0, finalEstimatedWage)
    }
  })

  const totalPayroll = payrollData.reduce((acc, p) => acc + p.finalEstimatedWage, 0)

  return (
    <div className="space-y-6">
      <PageHeader title={`ประเมินเงินเดือน (Payroll Preview)`} description={`สรุปค่าแรงและเวลาทำงานประจำเดือน ${month}/${year}`}>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/hr" />}>
            <ArrowLeft /> Back to HR
          </Button>
          <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
            <FileSpreadsheet className="size-4 mr-2" /> Export Excel
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 flex items-center gap-2"><Banknote className="size-4"/> Total Estimated Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{formatTHB(totalPayroll * 100)}</div>
            <p className="text-xs text-emerald-600/80 mt-1">ยอดเงินเดือนสุทธิรวมประจำเดือน</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">เรทการคำนวณ (บริษัท)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between"><span>ค่าล่วงเวลา (OT):</span> <span className="font-medium text-blue-600">ตามตัวคูณรายวัน</span></div>
              <div className="flex justify-between"><span>หักมาสาย:</span> <span className="font-medium text-red-500">฿{latePenalty}/นาที</span></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 border-t pt-2">ตั้งค่าได้ที่เมนู Settings {'>'} HR Settings</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium">พนักงาน</th>
              <th className="p-4 font-medium">ประเภท</th>
              <th className="p-4 font-medium text-center">มาทำงาน</th>
              <th className="p-4 font-medium text-center">ลา (ได้เงิน)</th>
              <th className="p-4 font-medium text-center text-blue-600">OT (+฿)</th>
              <th className="p-4 font-medium text-center text-amber-600">สาย (-฿)</th>
              <th className="p-4 font-medium text-center text-red-500">ลาหักเงิน (-฿)</th>
              <th className="p-4 font-medium text-right text-emerald-700">สุทธิ (฿)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payrollData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">ไม่มีข้อมูลพนักงาน</td>
              </tr>
            ) : (
              payrollData.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-medium">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-muted-foreground">{p.employee_code}</div>
                  </td>
                  <td className="p-4">
                    {p.employment_type === 'monthly' ? <Badge className="bg-blue-500">รายเดือน</Badge> : p.employment_type === 'daily' ? <Badge variant="secondary">รายวัน</Badge> : <Badge variant="outline">พาร์ทไทม์</Badge>}
                    <div className="text-xs text-muted-foreground mt-1">ฐาน: ฿{Number(p.daily_wage).toFixed(2)}</div>
                  </td>
                  <td className="p-4 text-center font-medium">{p.totalWorkDays} วัน</td>
                  <td className="p-4 text-center">{p.paidLeaveDays > 0 ? <span className="text-purple-600 font-medium">{p.paidLeaveDays} วัน</span> : "0"}</td>
                  <td className="p-4 text-center">
                    {p.totalOTHours > 0 ? (
                      <div className="text-blue-600 font-medium">
                        +{p.otAmount.toFixed(2)}
                        <div className="text-xs opacity-70">({p.totalOTHours.toFixed(1)} ชม.)</div>
                      </div>
                    ) : "0"}
                  </td>
                  <td className="p-4 text-center">
                    {p.totalLateMins > 0 ? (
                      <div className="text-amber-600 font-medium">
                        -{p.lateAmount.toFixed(2)}
                        <div className="text-xs opacity-70">({p.totalLateMins} นาที)</div>
                      </div>
                    ) : "0"}
                  </td>
                  <td className="p-4 text-center">
                    {p.unpaidLeaveDays > 0 ? (
                      <div className="text-red-500 font-medium">
                        -{p.leaveDeduction.toFixed(2)}
                        <div className="text-xs opacity-70">({p.unpaidLeaveDays} วัน)</div>
                      </div>
                    ) : "0"}
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600 text-base">{p.finalEstimatedWage.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
