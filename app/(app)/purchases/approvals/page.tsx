import Link from "next/link"
import { ShieldCheck, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default async function ApprovalsList() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: prs } = await supabase
    .from<any, any>("purchase_requests")
    .select("*, projects(name), pr_quotations!selected_quotation_id(price, quantity, suppliers(name))")
    .eq("org_id", ctx.orgId)
    .in("status", ["pending_approval", "approved", "rejected", "revision_requested"])
    .order("created_at", { ascending: false })

  const userIds = [...new Set(((prs as any[]) || []).map(p => p.requested_by))]
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds)
  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Approvals"
        description="ตรวจสอบและอนุมัติรายการขอจัดซื้อที่ผ่านการคัดเลือก Supplier แล้ว"
      />

      {!prs || prs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="ไม่มีรายการรออนุมัติ"
          description="ยังไม่มี PR ที่ถูกเลือก Supplier เข้ามาให้ตรวจสอบ"
        />
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-white/60">
              <tr>
                <th className="p-4 font-medium">PR Number</th>
                <th className="p-4 font-medium">Requester</th>
                <th className="p-4 font-medium">Project</th>
                <th className="p-4 font-medium">Selected Supplier</th>
                <th className="p-4 font-medium">Total Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {prs.map((pr: any) => {
                const quote = pr.pr_quotations
                const total = quote ? (quote.price) : 0
                
                return (
                  <tr key={pr.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-medium text-white">{pr.pr_number}</td>
                    <td className="p-4 text-white/70">{profileMap.get(pr.requested_by) || "Unknown"}</td>
                    <td className="p-4 text-white/70">{pr.projects?.name || "-"}</td>
                    <td className="p-4 text-white/70">{quote?.suppliers?.name || "-"}</td>
                    <td className="p-4 text-white/70">฿{total.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pr.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-300' :
                        pr.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        pr.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        pr.status === 'revision_requested' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-white/10 text-white/70'
                      }`}>
                        {pr.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" render={<Link href={`/purchases/approvals/${pr.id}`} />} >
                        Review <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
