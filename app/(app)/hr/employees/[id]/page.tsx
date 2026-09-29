import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireOrgContext } from "@/lib/auth"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EditEmployeeClient } from "./_components/edit-employee-client"

export const dynamic = "force-dynamic"

type AccountOption = {
  userId: string
  email: string
  role: "owner" | "admin" | "member"
}

type LinkedAccount = {
  userId: string
  email: string
  role: "owner" | "admin" | "member" | null
}

export default async function EditEmployeePage(props: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await props.params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", resolvedParams.id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!employee) return <div>Employee not found</div>

  const { data: shifts } = await supabase
    .from("shifts" as any)
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("name", { ascending: true })

  const currentYear = new Date().getFullYear()

  const { data: balance } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("year", currentYear)
    .maybeSingle()

  const canManageAccounts =
    ctx.role === "owner" || ctx.role === "admin"

  let accountOptions: AccountOption[] = []
  let linkedAccount: LinkedAccount | null = null

  if (canManageAccounts) {
    const adminClient = createAdminClient()

    const [
      { data: memberships },
      { data: linkedEmployees },
      authResult,
    ] = await Promise.all([
      adminClient
        .from("memberships")
        .select("user_id, role")
        .eq("org_id", ctx.orgId),

      adminClient
        .from("employees")
        .select("id, user_id")
        .eq("org_id", ctx.orgId)
        .not("user_id", "is", null),

      adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ])

    const emailById = new Map(
      (authResult.data?.users ?? []).map((user) => [
        user.id,
        user.email ?? user.id,
      ])
    )

    const membershipRows = (memberships ?? []) as Array<{
      user_id: string
      role: "owner" | "admin" | "member"
    }>

    const linkedElsewhere = new Set(
      ((linkedEmployees ?? []) as Array<{
        id: string
        user_id: string | null
      }>)
        .filter(
          (item) =>
            item.id !== employee.id &&
            item.user_id !== null
        )
        .map((item) => item.user_id as string)
    )

    accountOptions = membershipRows
      .filter((membership) => {
        if (linkedElsewhere.has(membership.user_id)) {
          return false
        }

        if (
          ctx.role !== "owner" &&
          membership.role === "owner"
        ) {
          return false
        }

        return true
      })
      .map((membership) => ({
        userId: membership.user_id,
        email:
          emailById.get(membership.user_id) ??
          membership.user_id,
        role: membership.role,
      }))
      .sort((a, b) => a.email.localeCompare(b.email))

    if (employee.user_id) {
      const currentMembership = membershipRows.find(
        (membership) =>
          membership.user_id === employee.user_id
      )

      linkedAccount = {
        userId: employee.user_id,
        email:
          emailById.get(employee.user_id) ??
          employee.user_id,
        role: currentMembership?.role ?? null,
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`แก้ไขข้อมูล: ${employee.first_name} ${employee.last_name}`}
        description="แก้ไขประวัติพนักงาน ประเภทการจ้างงาน และโควตาวันลา"
      >
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/hr/employees" />}
          >
            <ArrowLeft /> Back
          </Button>
        </div>
      </PageHeader>

      <EditEmployeeClient
        employee={employee}
        initialBalance={balance}
        currentYear={currentYear}
        shifts={shifts || []}
        canManageAccounts={canManageAccounts}
        accountOptions={accountOptions}
        linkedAccount={linkedAccount}
      />
    </div>
  )
}
