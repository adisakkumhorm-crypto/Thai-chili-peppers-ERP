import Link from "next/link"
import { ArrowLeft, Plus, ScanFace } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HrFilterBar } from "../_components/hr-filter-bar"

export const dynamic = "force-dynamic"

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  // Use select(*) to avoid type inference issues with new columns
  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || "").trim();
  const dept = resolvedParams.dept || "all";

  let query = supabase
    .from("employees")
    .select("*")
    .eq("org_id", ctx.orgId)
    
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_code.ilike.%${q}%`)
  }
  if (dept && dept !== "all") {
    query = query.eq("department", dept)
  }
  
  query = query.order("first_name")

  const { data: employees } = await query
    
  const { data: shifts } = await supabase.from("shifts" as any).select("*").eq("org_id", ctx.orgId);
  const shiftMap = (shifts || []).reduce((acc: any, s: any) => {
    acc[s.id] = s.name;
    return acc;
  }, {});
  
  // Get unique departments for filter
  const { data: allEmps } = await supabase.from("employees").select("department").eq("org_id", ctx.orgId);
  const departments = Array.from(new Set((allEmps || []).map(e => e.department).filter(Boolean))) as string[];

  const emps = (employees as any[]) ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="พนักงาน (Employees)" description="จัดการรายชื่อและข้อมูลพนักงาน">
        <div className="flex gap-2">
          <Link href="/hr"><Button variant="ghost" size="sm">
            <ArrowLeft /> Back
          </Button></Link>
          <Link href="/hr/employees/new"><Button size="sm">
            <Plus data-icon="inline-start" /> เพิ่มพนักงาน
          </Button></Link>
        </div>
      </PageHeader>

      <HrFilterBar q={q} dept={dept} departments={departments} />
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium">รหัสพนักงาน</th>
              <th className="p-4 font-medium">ชื่อ-สกุล</th>
              <th className="p-4 font-medium">ตำแหน่ง</th>
              <th className="p-4 font-medium">สิทธิ์ (Role)</th>
              <th className="p-4 font-medium">ประเภท</th>
              <th className="p-4 font-medium">กะการทำงาน</th>
              <th className="p-4 font-medium text-right">ฐานเงินเดือน/ค่าแรง</th>
              <th className="p-4 font-medium text-center">ข้อมูลใบหน้า</th>
              <th className="p-4 font-medium">สถานะ</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {emps.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">ไม่มีข้อมูลพนักงาน</td>
              </tr>
            ) : (
              emps.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td className="p-4 font-medium">{emp.employee_code}</td>
                  <td className="p-4">
                    <div className="font-medium">{emp.first_name} {emp.last_name} {emp.nickname ? `(${emp.nickname})` : ""}</div>
                    <div className="text-xs text-muted-foreground">{emp.department || "—"}</div>
                  </td>
                  <td className="p-4">{emp.position || "—"}</td>
                  <td className="p-4"><Badge variant="outline" className="capitalize">{emp.role}</Badge></td>
                  <td className="p-4">
                    {emp.employment_type === 'monthly' ? <Badge className="bg-blue-500">รายเดือน</Badge> : emp.employment_type === 'daily' ? <Badge variant="secondary">รายวัน</Badge> : <Badge variant="outline">พาร์ทไทม์</Badge>}
                  </td>
                  <td className="p-4 text-xs">
                    {emp.shift_id && shiftMap[emp.shift_id] ? (
                      <Badge variant="outline">{shiftMap[emp.shift_id]}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right font-medium text-emerald-600">฿{emp.daily_wage.toFixed(2)}</td>
                  <td className="p-4 text-center">
                    {emp.face_descriptor ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">มีข้อมูลแล้ว</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">ยังไม่มี</Badge>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant={emp.is_active ? "default" : "secondary"}>
                      {emp.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-4 text-right flex gap-2 justify-end">
                    <Link href={`/hr/employees/${emp.id}/face`}><Button variant="outline" size="sm" title="ลงทะเบียนหน้า">
                      <ScanFace className="size-4" /> 
                    </Button></Link>
                    <Link href={`/hr/employees/${emp.id}`}><Button variant="secondary" size="sm">
                      แก้ไข
                    </Button></Link>
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
