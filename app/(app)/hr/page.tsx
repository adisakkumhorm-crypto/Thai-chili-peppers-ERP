import Link from "next/link"
import { Users, QrCode, Clock, HardHat, Calendar } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatTHB } from "@/lib/money"
import { ScannerClientWrapper } from "./_components/scanner-wrapper"

export const dynamic = "force-dynamic"

export default async function HRDashboardPage() {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/hr")
  const supabase = await createClient()

  // Fetch employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("first_name")

  // Fetch active projects for check-in
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("status", ["not_started", "in_progress"])
    .eq("org_id", ctx.orgId)
    .order("name")

  // Fetch today's timesheets
  const today = new Date().toISOString().split('T')[0]
  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("*, employees(first_name, last_name, position), projects(name)")
    .eq("work_date", today)
    .eq("org_id", ctx.orgId)
    .order("check_in", { ascending: false })

  const emps = employees ?? []
  const projs = projects ?? []
  const tss = timesheets ?? []

  const activeWorkers = tss.filter(t => t.status === "working").length
  const completedWorkers = tss.filter(t => t.status === "completed").length

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Timesheet" description="Manage employees and track time via QR Code">
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/hr/employees" />}>
            <Users data-icon="inline-start" /> จัดการพนักงาน
          </Button>
          <Button variant="outline" render={<Link href="/hr/leaves" />}>
            <Calendar data-icon="inline-start" /> พิจารณาใบลา
          </Button>
          <Button variant="outline" render={<Link href="/hr/leave-balances" />}>
            <Calendar data-icon="inline-start" /> รายงานวันลาคงเหลือ
          </Button>
          <Button variant="outline" render={<Link href="/hr/timesheets" />}>
            <Clock data-icon="inline-start" /> Timesheet History
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emps.length}</div>
            <p className="text-xs text-muted-foreground">Active staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Working</CardTitle>
            <HardHat className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeWorkers}</div>
            <p className="text-xs text-muted-foreground">Checked in today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Shifts</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completedWorkers}</div>
            <p className="text-xs text-muted-foreground">Checked out today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="size-5" /> AI Face Scan Kiosk (เครื่องสแกนใบหน้า)</CardTitle>
          </CardHeader>
          <CardContent>
            <ScannerClientWrapper projects={projs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HardHat className="size-5" /> พนักงานที่เข้างานวันนี้ (Today's Roster)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tss.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                ยังไม่มีพนักงานสแกนเข้างานในวันนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Project</th>
                      <th className="p-3 font-medium">Time In</th>
                      <th className="p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tss.map((ts: any) => (
                      <tr key={ts.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{ts.employees?.first_name} {ts.employees?.last_name}</div>
                          <div className="text-xs text-muted-foreground">{ts.employees?.position}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{ts.projects?.name || "General"}</td>
                        <td className="p-3">
                          {new Date(ts.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: ctx.timezone })}
                          {ts.check_out && (
                            <span className="text-muted-foreground"> - {new Date(ts.check_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: ctx.timezone })}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {ts.status === "working" ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">กำลังทำงาน</Badge>
                          ) : (
                            <Badge variant="secondary">เลิกงานแล้ว</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
