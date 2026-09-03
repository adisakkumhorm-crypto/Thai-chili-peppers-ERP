import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { FaceRegistrationClient } from "./_components/face-registration-client"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function EmployeeFaceRegistrationPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  console.log("HIT FACE PAGE. params:", params);

  let ctx;
  try {
    ctx = await requireOrgContext()
  } catch (e) {
    console.error("requireOrgContext error:", e);
    throw e;
  }

  // Await params in Next.js 15+
  const resolvedParams = await params;
  const employeeId = resolvedParams.id;
  console.log("Employee ID extracted:", employeeId);

  const supabase = await createClient()

  const { data: emp, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("org_id", ctx.orgId)
    .single()

  if (error) {
    console.error("Fetch employee error:", error);
  }

  if (!emp) { 
    console.error("Employee not found error. orgId:", ctx.orgId, "paramsId:", employeeId); 
    return notFound(); 
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`ลงทะเบียนใบหน้า: ${emp.first_name} ${emp.last_name}`} 
        description="บันทึกข้อมูลโครงสร้างใบหน้าเพื่อใช้สแกนเข้างาน"
      >
        <div className="flex gap-2">
          <Link href="/hr/employees"><Button variant="ghost" size="sm">
            <ArrowLeft /> Back
          </Button></Link>
        </div>
      </PageHeader>
      
      <div className="max-w-2xl">
        <FaceRegistrationClient employeeId={emp.id} hasExisting={!!(emp as any).face_descriptor} />
      </div>
    </div>
  )
}
