import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmployeeForm } from "../_components/employee-form"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"

export default async function NewEmployeePage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const { data: shifts } = await supabase
    .from("shifts" as any)
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="เพิ่มพนักงานใหม่" description="สร้างประวัติพนักงานและกำหนดรหัส QR Code">
        <Button variant="ghost" size="sm" render={<Link href="/hr/employees" />}>
          <ArrowLeft /> กลับ
        </Button>
      </PageHeader>
      <div className="p-6 border rounded-md bg-card">
        <EmployeeForm shifts={shifts || []} />
      </div>
    </div>
  )
}
