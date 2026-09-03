import Link from "next/link"
import { ArrowLeft, Clock } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { formatTHB } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { EditOTMultiplier } from "./_components/edit-ot-multiplier"
import { HrFilterBar } from "../_components/hr-filter-bar"

export const dynamic = "force-dynamic"

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || "").trim();
  const dept = resolvedParams.dept || "all";

  let query = supabase
    .from("timesheets")
    .select("*, employees!inner(first_name, last_name, employee_code, department), projects(name)")
    .eq("org_id", ctx.orgId)
    
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_code.ilike.%${q}%`, { foreignTable: 'employees' })
  }
  if (dept && dept !== "all") {
    query = query.eq("employees.department", dept)
  }

  query = query.order("work_date", { ascending: false }).order("check_in", { ascending: false })

  const { data: timesheets } = await query
  
  // Get unique departments for filter
  const { data: allEmps } = await supabase.from("employees").select("department").eq("org_id", ctx.orgId).eq("is_active", true);
  const departments = Array.from(new Set((allEmps || []).map(e => e.department).filter(Boolean))) as string[];

  const tss = timesheets ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Timesheet History" description="ประวัติการเข้า-ออกงานและค่าแรง">
        <Button variant="ghost" size="sm" render={<Link href="/hr" />}>
          <ArrowLeft /> Back to HR
        </Button>
      </PageHeader>

      <HrFilterBar q={q} dept={dept} departments={departments} />
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium">วันที่ (Date)</th>
              <th className="p-4 font-medium">พนักงาน (Employee)</th>
              <th className="p-4 font-medium">โปรเจกต์ (Project)</th>
              <th className="p-4 font-medium">เข้างาน (In) - ออกงาน (Out)</th>
              <th className="p-4 font-medium text-center">ชั่วโมง (Hrs)</th>
              <th className="p-4 font-medium text-right">ค่าแรง (Wage)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tss.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">ไม่มีประวัติการทำงาน</td>
              </tr>
            ) : (
              tss.map((ts: any) => (
                <tr key={ts.id} className="hover:bg-muted/30">
                  <td className="p-4 text-muted-foreground">{new Date(ts.work_date).toLocaleDateString('th-TH', { timeZone: ctx.timezone })}</td>
                  <td className="p-4">
                    <div className="font-medium">{ts.employees?.first_name} {ts.employees?.last_name}</div>
                    <div className="text-xs text-muted-foreground">{ts.employees?.employee_code} • {ts.employees?.department || "—"}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">{ts.projects?.name || "General"}</td>
                  <td className="p-4">
                    {new Date(ts.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: ctx.timezone })}
                    {ts.check_out ? (
                      <span> - {new Date(ts.check_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: ctx.timezone })}</span>
                    ) : (
                      <Badge variant="outline" className="ml-2 text-emerald-600 bg-emerald-50">กำลังทำงาน</Badge>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {ts.status === "completed" ? (
                      <div>
                        <span className="font-medium">{Number(ts.regular_hours) + Number(ts.ot_hours)}h</span>
                        {Number(ts.ot_hours) > 0 && (
                          <div className="flex flex-col items-center justify-center mt-1">
                            <div className="text-[10px] text-amber-600">OT: {ts.ot_hours}h</div>
                            <EditOTMultiplier timesheetId={ts.id} currentMultiplier={ts.ot_multiplier} />
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 text-right font-medium text-purple-600">
                    {ts.status === "completed" ? formatTHB(ts.wage_amount * 100) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
