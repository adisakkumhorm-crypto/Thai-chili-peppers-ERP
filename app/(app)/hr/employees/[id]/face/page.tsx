import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  requireFeatureAccessOrRedirect,
  requireOrgContext,
} from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { FaceRegistrationClient } from "./_components/face-registration-client"

export const dynamic = "force-dynamic"

export default async function EmployeeFaceRegistrationPage({
  params,
}: {
  params:
    | Promise<{ id: string }>
    | { id: string }
}) {
  const ctx = await requireOrgContext()

  requireFeatureAccessOrRedirect(
    ctx,
    "/hr"
  )

  const resolvedParams = await params
  const employeeId = resolvedParams.id

  const supabase = await createClient()

  const {
    data: emp,
    error: employeeError,
  } = await supabase
    .from("employees")
    .select(
      "id, first_name, last_name"
    )
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    .single()

  if (employeeError || !emp) {
    return notFound()
  }

  const {
    data: faceStatuses,
    error: faceStatusError,
  } = await supabase.rpc(
    "rpc_face_enrollment_statuses",
    {
      p_org_id: ctx.orgId,
    }
  )

  if (faceStatusError) {
    throw new Error(
      faceStatusError.message
    )
  }

  const hasExisting =
    (faceStatuses ?? []).some(
      (row) =>
        row.employee_id === emp.id
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ลงทะเบียนใบหน้า: ${emp.first_name} ${emp.last_name}`}
        description="บันทึกข้อมูลโครงสร้างใบหน้าเพื่อใช้สแกนเข้างาน"
      >
        <div className="flex gap-2">
          <Link href="/hr/employees">
            <Button
              variant="ghost"
              size="sm"
            >
              <ArrowLeft />
              Back
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="max-w-2xl">
        <FaceRegistrationClient
          employeeId={emp.id}
          hasExisting={hasExisting}
        />
      </div>
    </div>
  )
}
