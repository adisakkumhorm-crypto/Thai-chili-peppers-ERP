import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { PRForm } from "../_components/pr-form"

export default async function NewPRPage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  // ดึง Projects ให้เลือก
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("org_id", ctx.orgId)
    .order("name")

  // ดึง Products ให้เลือก
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("org_id", ctx.orgId)
    .order("name")

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Create Purchase Request"
        description="ระบุรายละเอียดเพื่อขอจัดซื้อสินค้าหรือวัสดุ"
      />
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <PRForm projects={projects || []} products={products || []} />
      </div>
    </div>
  )
}
