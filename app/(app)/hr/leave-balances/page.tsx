import Link from "next/link"
import { ArrowLeft, FileSpreadsheet } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { HrFilterBar } from "../_components/hr-filter-bar"

export const dynamic = "force-dynamic"

export default async function LeaveBalancesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const currentYear = new Date().getFullYear()

  // Fetch employees and their balances
  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || "").trim();
  const dept = resolvedParams.dept || "all";

  let query = supabase
    .from("employees")
    .select("*, leave_balances(*)")
    .eq("org_id", ctx.orgId)
    .eq("is_active", true)

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_code.ilike.%${q}%`)
  }
  if (dept && dept !== "all") {
    query = query.eq("department", dept)
  }
  
  query = query.order("first_name")

  const { data: employees } = await query
  
  // Get unique departments for filter
  const { data: allEmps } = await supabase.from("employees").select("department").eq("org_id", ctx.orgId).eq("is_active", true);
  const departments = Array.from(new Set((allEmps || []).map(e => e.department).filter(Boolean))) as string[];

  const emps = (employees as any[]) ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="รายงานวันลาคงเหลือ" description={`สรุปสิทธิ์การลางานและจำนวนวันที่ใช้ไปของพนักงานทุกคน ประจำปี ${currentYear}`}>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/hr" />}>
            <ArrowLeft /> Back to HR
          </Button>
          <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
            <FileSpreadsheet className="size-4 mr-2" /> Export Excel
          </Button>
        </div>
      </PageHeader>

      <HrFilterBar q={q} dept={dept} departments={departments} />
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium" rowSpan={2}>พนักงาน</th>
              <th className="p-4 font-medium text-center border-l" colSpan={3}>ลาป่วย (Sick)</th>
              <th className="p-4 font-medium text-center border-l" colSpan={3}>ลากิจ (Personal)</th>
              <th className="p-4 font-medium text-center border-l bg-emerald-50/50" colSpan={3}>ลาพักร้อน (Vacation)</th>
              <th className="p-4 font-medium text-right border-l" rowSpan={2}>จัดการ</th>
            </tr>
            <tr className="border-b bg-muted/20 text-center text-xs">
              <th className="p-2 font-medium border-l">สิทธิ์</th>
              <th className="p-2 font-medium text-amber-600">ใช้ไป</th>
              <th className="p-2 font-medium text-emerald-600">คงเหลือ</th>
              <th className="p-2 font-medium border-l">สิทธิ์</th>
              <th className="p-2 font-medium text-amber-600">ใช้ไป</th>
              <th className="p-2 font-medium text-emerald-600">คงเหลือ</th>
              <th className="p-2 font-medium border-l bg-emerald-50/50">สิทธิ์</th>
              <th className="p-2 font-medium text-amber-600 bg-emerald-50/50">ใช้ไป</th>
              <th className="p-2 font-medium text-emerald-600 bg-emerald-50/50">คงเหลือ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {emps.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">ไม่มีข้อมูลพนักงาน</td>
              </tr>
            ) : (
              emps.map((emp) => {
                const bal = emp.leave_balances?.find((b: any) => b.year === currentYear) || {
                  sick_total: 30, sick_used: 0,
                  personal_total: 6, personal_used: 0,
                  vacation_total: 6, vacation_used: 0
                }
                
                return (
                  <tr key={emp.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-medium">{emp.first_name} {emp.last_name}</div>
                      <div className="text-xs text-muted-foreground">{emp.employee_code}</div>
                    </td>
                    
                    <td className="p-4">{emp.position || "—"} <br/><span className="text-xs text-muted-foreground">{emp.department || "—"}</span></td>
                    <td className="p-4 text-center border-l bg-muted/5">{bal.sick_total}</td>
                    <td className="p-4 text-center text-amber-600 bg-muted/5">{bal.sick_used}</td>
                    <td className="p-4 text-center font-bold text-emerald-600 bg-muted/5">{bal.sick_total - bal.sick_used}</td>
                    
                    <td className="p-4 text-center border-l">{bal.personal_total}</td>
                    <td className="p-4 text-center text-amber-600">{bal.personal_used}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">{bal.personal_total - bal.personal_used}</td>
                    
                    <td className="p-4 text-center border-l bg-emerald-50/30">{bal.vacation_total}</td>
                    <td className="p-4 text-center text-amber-600 bg-emerald-50/30">{bal.vacation_used}</td>
                    <td className="p-4 text-center font-bold text-emerald-600 bg-emerald-50/30">{bal.vacation_total - bal.vacation_used}</td>

                    <td className="p-4 text-right border-l">
                      <Link href={`/hr/employees/${emp.id}`}>
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          ปรับโควตา
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
