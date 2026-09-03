import { PageHeader } from "@/components/page-header"
import { CheckInClient } from "./_components/check-in-client"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function CheckInPage() {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/check-in")
  const supabase = await createClient()

  // Fetch active projects for check-in
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("status", ["not_started", "in_progress"])
    .eq("org_id", ctx.orgId)
    .order("name")

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <PageHeader title="ตอกบัตร (Check-in)" description="สแกนใบหน้าและเช็คพิกัดเพื่อเข้า-ออกงาน" />
      <CheckInClient projects={projects ?? []} />
    </div>
  )
}
