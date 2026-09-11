import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"

export default async function MyRequestsPage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: prs } = await supabase
    .from<any, any>("purchase_requests")
    .select("*, projects(name), purchase_request_items(count)")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="My Requests"
        description="รายการคำขอจัดซื้อของคุณ (Purchase Requests)"
      >
        <Button render={<Link href="/my-requests/new" />}>
          <Plus className="mr-2 h-4 w-4" /> สร้างคำขอจัดซื้อ
        </Button>
      </PageHeader>
      
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 border-b border-white/10 text-white/60">
            <tr>
              <th className="p-4 font-medium">PR Number</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Project</th>
              <th className="p-4 font-medium">Items</th>
              <th className="p-4 font-medium">Reason</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(!prs || prs.length === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/50">ไม่มีประวัติคำขอจัดซื้อ</td>
              </tr>
            )}
            {prs?.map((pr: any) => (
              <tr key={pr.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-medium text-white">{pr.pr_number}</td>
                <td className="p-4 text-white/70">{new Date(pr.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-white/70">{pr.projects?.name || "-"}</td>
                <td className="p-4 text-white/70">{pr.purchase_request_items?.[0]?.count || 0}</td>
                <td className="p-4 text-white/70 truncate max-w-[200px]">{pr.reason || "-"}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    pr.status === 'draft' ? 'bg-zinc-500/20 text-zinc-300' :
                    pr.status === 'submitted' ? 'bg-blue-500/20 text-blue-300' :
                    pr.status === 'in_procurement' ? 'bg-purple-500/20 text-purple-300' :
                    pr.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                    pr.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                    'bg-white/10 text-white/70'
                  }`}>
                    {pr.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
