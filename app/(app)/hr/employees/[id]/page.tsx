import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EditEmployeeClient } from "./_components/edit-employee-client"

export const dynamic = "force-dynamic"

export default async function EditEmployeePage(props: { params: Promise<{ id: string }> }) {
  const resolvedParams = await props.params;
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

  return (
    <div className="space-y-6">
      <PageHeader title={`แก้ไขข้อมูล: ${employee.first_name} ${employee.last_name}`} description="แก้ไขประวัติพนักงาน ประเภทการจ้างงาน และโควตาวันลา">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/hr/employees" />}>
            <ArrowLeft /> Back
          </Button>
        </div>
      </PageHeader>

      <EditEmployeeClient employee={employee} initialBalance={balance} currentYear={currentYear} shifts={shifts || []} />
    </div>
  )
}
