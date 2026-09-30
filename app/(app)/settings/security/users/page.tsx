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

import { PermanentDeleteLoginButton } from "./_components/permanent-delete-login-button"

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

  const { data: removedEvents, error: removedEventsError } =
    await adminClient
      .from("audit_log")
      .select("id, entity_id, actor_email, meta, created_at")
      .eq("org_id", ctx.orgId)
      .eq("entity", "membership")
      .eq("action", "REMOVE_MEMBER")
      .order("created_at", { ascending: false })

  if (removedEventsError) {
    throw new Error(removedEventsError.message)
  }

  // Keep only the latest removal event for each Login.
  const latestRemovedEvents = []
  const seenRemovedUsers = new Set<string>()

  for (const event of removedEvents ?? []) {
    const targetUserId =
      event.entity_id ??
      (
        typeof event.meta === "object" &&
        event.meta !== null &&
        !Array.isArray(event.meta) &&
        typeof (event.meta as Record<string, unknown>).target_user_id === "string"
          ? (event.meta as Record<string, unknown>).target_user_id as string
          : null
      )

    if (!targetUserId || seenRemovedUsers.has(targetUserId)) {
      continue
    }

    seenRemovedUsers.add(targetUserId)

    latestRemovedEvents.push({
      ...event,
      targetUserId,
    })
  }

  const removedRows = await Promise.all(
    latestRemovedEvents.map(async (event) => {
      const meta =
        typeof event.meta === "object" &&
        event.meta !== null &&
        !Array.isArray(event.meta)
          ? event.meta as Record<string, unknown>
          : {}

      const [
        authResult,
        membershipResult,
        employeeResult,
        prResult,
      ] = await Promise.all([
        adminClient.auth.admin.getUserById(event.targetUserId),

        adminClient
          .from("memberships")
          .select("*", { count: "exact", head: true })
          .eq("user_id", event.targetUserId)
          .eq("org_id", ctx.orgId),

        adminClient
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("user_id", event.targetUserId)
          .eq("org_id", ctx.orgId),

        adminClient
          .from("purchase_requests")
          .select("*", { count: "exact", head: true })
          .eq("requested_by", event.targetUserId)
          .eq("org_id", ctx.orgId),
      ])

      const emailFromTombstone =
        typeof meta.target_email === "string"
          ? meta.target_email
          : null

      return {
        userId: event.targetUserId,
        email:
          authResult.data.user?.email ??
          emailFromTombstone ??
          "Unknown",
        authExists: Boolean(authResult.data.user),
        removedAt: event.created_at,
        removedBy: event.actor_email ?? "Unknown",
        currentOrgMembership: membershipResult.count ?? 0,
        employeeCount: employeeResult.count ?? 0,
        prCount: prResult.count ?? 0,
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
          หน้านี้เป็น Owner-only สำหรับตรวจสอบ Login Security
          การลบ Login ถาวรอนุญาตเฉพาะบัญชีที่ผ่าน Removed Login Candidate
          และต้องผ่านการตรวจสอบความสัมพันธ์ทั้งระบบก่อนลบ
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Removed Login Candidates
          </CardTitle>
          <CardDescription>
            ประวัติ Login ที่เคยถูกนำออกจากองค์กรนี้
            Permanent Delete จะเปิดให้เฉพาะ Candidate ที่ไม่มี blocker ที่ตรวจพบ
            และ Server จะตรวจสอบ Global Safety ซ้ำอีกครั้งก่อนลบจริง
          </CardDescription>
        </CardHeader>

        <CardContent>
          {removedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มี Login ที่ถูกนำออกจากองค์กรนี้
            </p>
          ) : (
            <div className="divide-y">
              {removedRows.map((row) => (
                <div
                  key={row.userId}
                  className="space-y-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {row.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.userId}
                      </p>
                    </div>

                    {row.currentOrgMembership > 0 ? (
                      <Badge variant="outline">
                        กลับเข้าองค์กรแล้ว
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        Removed
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">
                        Current access:
                      </span>{" "}
                      {row.currentOrgMembership > 0 ? "Active" : "Removed"}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Employee link:
                      </span>{" "}
                      {row.employeeCount}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        PR history:
                      </span>{" "}
                      {row.prCount}
                    </div>

                    <div>
                      <span className="text-muted-foreground">
                        Removed by:
                      </span>{" "}
                      {row.removedBy}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Removed at:{" "}
                    {new Date(row.removedAt).toLocaleString("th-TH")}
                  </p>

                  {row.currentOrgMembership > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Login นี้กลับเข้ามาเป็นสมาชิกขององค์กรแล้ว
                      จึงไม่ถือเป็น Removed Login Candidate ในสถานะปัจจุบัน
                    </p>
                  )}

                  {row.employeeCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ยังผูก Employee ในองค์กรนี้อยู่
                    </p>
                  )}

                  {!row.authExists && (
                    <p className="text-xs text-muted-foreground">
                      บัญชี Login นี้ไม่มีอยู่ใน Auth แล้ว
                    </p>
                  )}

                  {row.authExists &&
                    row.currentOrgMembership === 0 &&
                    row.employeeCount === 0 &&
                    row.prCount === 0 && (
                      <div className="pt-2">
                        <PermanentDeleteLoginButton
                          userId={row.userId}
                          orgId={ctx.orgId}
                          email={row.email}
                        />
                      </div>
                    )}

                  {row.authExists &&
                    (
                      row.currentOrgMembership > 0 ||
                      row.employeeCount > 0 ||
                      row.prCount > 0
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        Permanent Delete ถูกปิดใช้งานจนกว่า blocker ที่แสดงด้านบนจะถูกแก้ไข
                      </p>
                    )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
