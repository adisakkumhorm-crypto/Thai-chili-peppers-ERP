import Link from "next/link"
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"

import { requireOrgContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export const dynamic = "force-dynamic"

export default async function LoginSecurityUsersPage() {
  const ctx = await requireOrgContext()

  if (ctx.role !== "owner") {
    redirect("/unauthorized")
  }

  const adminClient = createAdminClient()

  const { data: memberships, error: membershipsError } =
    await adminClient
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: true })

  if (membershipsError) {
    throw new Error(membershipsError.message)
  }

  const rows = await Promise.all(
    (memberships ?? []).map(async (membership) => {
      const [
        authResult,
        employeeCountResult,
        prCountResult,
      ] = await Promise.all([
        adminClient.auth.admin.getUserById(membership.user_id),

         adminClient
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("user_id", membership.user_id)
          .eq("org_id", ctx.orgId),

        adminClient
          .from("purchase_requests")
          .select("*", { count: "exact", head: true })
          .eq("requested_by", membership.user_id)
          .eq("org_id", ctx.orgId),
      ])

       const employeeCount =
        employeeCountResult.count ?? 0

      const prCount =
        prCountResult.count ?? 0

      const blockers: string[] = []

      if (membership.user_id === ctx.userId) {
        blockers.push("บัญชีที่กำลังใช้งาน")
      }

      if (membership.role === "owner") {
        blockers.push("Owner")
      }

       if (employeeCount > 0) {
        blockers.push("ยังผูก Employee")
      }

      if (prCount > 0) {
        blockers.push("มีประวัติ PR")
      }

      return {
        userId: membership.user_id,
        email:
          authResult.data.user?.email ??
          "Unknown",
        role: membership.role,
        employeeCount,
        prCount,
        blockers,
      }
    })
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login & Security"
        description="ตรวจสอบบัญชี Login และสถานะความปลอดภัยก่อนดำเนินการถาวร"
      >
        <Button
          variant="outline"
          render={<Link href="/settings" />}
        >
          <ArrowLeft />
          Settings
        </Button>
      </PageHeader>

      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Owner only</AlertTitle>
        <AlertDescription>
          หน้านี้แสดงเฉพาะบัญชีที่ยังเชื่อมโยงกับองค์กรปัจจุบัน
          และยังไม่อนุญาตให้ลบบัญชี Login
          บัญชีที่ไม่มีความสัมพันธ์กับองค์กรจะไม่ถูกแสดงเพื่อป้องกันการเข้าถึงข้ามองค์กร
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" />
            Login Accounts
          </CardTitle>
          <CardDescription>
            ตรวจสอบ Membership, Employee link และประวัติ PR
            ก่อนเปิดใช้ Permanent Login Delete ในขั้นตอนถัดไป
          </CardDescription>
        </CardHeader>

        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ไม่พบบัญชี Login ในองค์กรนี้
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div
                  key={row.userId}
                  className="space-y-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {row.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.userId}
                      </p>
                    </div>

                    <Badge variant="outline">
                      {row.role}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">
                        Organization access:
                      </span>{" "}
                      Active
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Employee link in this organization:
                      </span>{" "}
                      {row.employeeCount}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        PR history in this organization:
                      </span>{" "}
                      {row.prCount}
                    </div>
                  </div>

                  <div>
                    {row.blockers.length === 0 ? (
                      <Badge>
                        ไม่มี blocker ที่ตรวจพบ
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {row.blockers.map((blocker) => (
                          <Badge
                            key={blocker}
                            variant="outline"
                          >
                            {blocker}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
