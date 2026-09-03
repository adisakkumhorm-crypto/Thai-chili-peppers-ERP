import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { HRSettingsClient } from "./_components/hr-settings-client"

export const dynamic = "force-dynamic"

export default async function HRSettingsPage() {
  const ctx = await requireOrgContext()
  requireRole(ctx, ["owner", "admin"])
  const supabase = await createClient()
  
  const [{ data: org }, { data: holidays }, { data: shifts }] = await Promise.all([
    supabase.from("organizations").select("working_days, ot_rate_per_hour, late_penalty_per_minute").eq("id", ctx.orgId).single(),
    supabase.from("public_holidays").select("*").eq("org_id", ctx.orgId).order("date", { ascending: true }),
    supabase.from("shifts" as any).select("*").eq("org_id", ctx.orgId).order("name", { ascending: true })
  ])

  const workingDays = org?.working_days || [1,2,3,4,5]

  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่า HR & การลางาน" description="กำหนดวันทำงานปกติและวันหยุดนักขัตฤกษ์ของบริษัท">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/settings" />}>
            <ArrowLeft /> Back to Settings
          </Button>
        </div>
      </PageHeader>

      <HRSettingsClient 
        initialWorkingDays={workingDays} 
        initialHolidays={holidays || []} 
        initialOtRate={org?.ot_rate_per_hour || 0}
        initialLatePenalty={org?.late_penalty_per_minute || 0}
        initialShifts={shifts || []}
      />
    </div>
  )
}
