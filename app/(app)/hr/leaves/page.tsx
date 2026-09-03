import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { updateLeaveStatus } from "./actions"
import { HrFilterBar } from "../_components/hr-filter-bar"

export const dynamic = "force-dynamic"

function LeaveStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-500">อนุมัติแล้ว</Badge>
  if (status === "rejected") return <Badge variant="destructive">ไม่อนุมัติ</Badge>
  return <Badge variant="secondary" className="text-amber-600 bg-amber-50">รอพิจารณา</Badge>
}

export default async function HRLeavesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/my-leave")
  
  const supabase = await createClient()

  // Fetch all leave requests
  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || "").trim();
  const dept = resolvedParams.dept || "all";

  let query = supabase
    .from("leave_requests")
    .select("*, employees!inner(first_name, last_name, employee_code, department)")
    .eq("org_id", ctx.orgId)
    
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_code.ilike.%${q}%`, { foreignTable: 'employees' })
  }
  if (dept && dept !== "all") {
    query = query.eq("employees.department", dept)
  }

  query = query.order("created_at", { ascending: false })

  const { data: requests } = await query
  
  // Get unique departments for filter
  const { data: allEmps } = await supabase.from("employees").select("department").eq("org_id", ctx.orgId).eq("is_active", true);
  const departments = Array.from(new Set((allEmps || []).map(e => e.department).filter(Boolean))) as string[];

  const reqs = requests ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="พิจารณาคำขอลาหยุด (Leave Approvals)" description="อนุมัติหรือปฏิเสธคำขอลาหยุดของพนักงาน">
        <Button variant="ghost" size="sm" render={<Link href="/hr" />}>
          <ArrowLeft /> Back to HR
        </Button>
      </PageHeader>

      <HrFilterBar q={q} dept={dept} departments={departments} />
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium">วันที่ยื่น</th>
              <th className="p-4 font-medium">พนักงาน</th>
              <th className="p-4 font-medium">ประเภทการลา</th>
              <th className="p-4 font-medium">ช่วงเวลาที่ลา</th>
              <th className="p-4 font-medium">เหตุผล</th>
              <th className="p-4 font-medium text-center">สถานะ</th>
              <th className="p-4 font-medium text-right">การพิจารณา</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reqs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">ไม่มีคำขอลาหยุด</td>
              </tr>
            ) : (
              reqs.map((req: any) => (
                <tr key={req.id} className="hover:bg-muted/30">
                  <td className="p-4 text-muted-foreground">{new Date(req.created_at as string).toLocaleDateString('th-TH', { timeZone: ctx.timezone })}</td>
                  <td className="p-4">
                    <div className="font-medium">{req.employees?.first_name} {req.employees?.last_name}</div>
                    <div className="text-xs text-muted-foreground">{req.employees?.employee_code} • {req.employees?.department || "—"}</div>
                  </td>
                  <td className="p-4 font-medium capitalize">{req.type === 'sick' ? 'ลาป่วย' : req.type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}</td>
                  <td className="p-4">
                    {new Date(req.start_date as string).toLocaleDateString('th-TH', { timeZone: ctx.timezone })} 
                    {(req.start_date as string) !== (req.end_date as string) && ` - ${new Date(req.end_date as string).toLocaleDateString('th-TH', { timeZone: ctx.timezone })}`}
                  </td>
                  <td className="p-4 text-muted-foreground max-w-[200px] truncate">{(req.reason as string) || "—"}</td>
                  <td className="p-4 text-center">
                    <LeaveStatusBadge status={(req.status as string) || "pending"} />
                  </td>
                  <td className="p-4 text-right">
                    {req.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <form action={async () => { "use server"; await updateLeaveStatus(req.id, "approved") }}>
                          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" type="submit">อนุมัติ</Button>
                        </form>
                        <form action={async () => { "use server"; await updateLeaveStatus(req.id, "rejected") }}>
                          <Button size="sm" variant="outline" className="h-8 text-destructive hover:bg-destructive/10" type="submit">ปฏิเสธ</Button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">ดำเนินการแล้ว</span>
                    )}
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
