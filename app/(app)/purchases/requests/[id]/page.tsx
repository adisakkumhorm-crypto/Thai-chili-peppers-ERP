import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

import { QuotationList } from "./_components/quotation-list"

export default async function PRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  // Fetch PR
  const { data: pr } = await supabase
    .from<any, any>("purchase_requests")
    .select("*, projects(name)")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!pr) return notFound()

  // Fetch Items
  const { data: items } = await supabase
    .from("purchase_request_items")
    .select("*, products(name)")
    .eq("pr_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true })

  // Fetch Requester Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", (pr as any).requested_by)
    .single()

  // Fetch Quotations
  const { data: quotations } = await supabase
    .from<any, any>("pr_quotations")
    .select("*, suppliers(name)")
    .eq("pr_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    
  // Fetch Suppliers for dropdown
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("org_id", ctx.orgId)
    .order("name", { ascending: true })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/purchases/requests" />}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <PageHeader
          title={`Purchase Request: ${(pr as any).pr_number}`}
          description="รายละเอียดคำขอจัดซื้อ และการเสนอราคาจาก Supplier"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-2">PR Info</h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <span className="block text-white/50 text-xs mb-1">Requester</span>
              <span className="text-white/90">{profile?.full_name || "Unknown"}</span>
            </div>
            <div>
              <span className="block text-white/50 text-xs mb-1">Project</span>
              <span className="text-white/90">{(pr as any).projects?.name || "-"}</span>
            </div>
            <div>
              <span className="block text-white/50 text-xs mb-1">Required Date</span>
              <span className="text-white/90">{(pr as any).required_date ? new Date((pr as any).required_date).toLocaleDateString() : "-"}</span>
            </div>
            <div>
              <span className="block text-white/50 text-xs mb-1">Status</span>
              <span className="text-white/90 capitalize">{(pr as any).status}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-white/50 text-xs mb-1">Reason / Description</span>
              <span className="text-white/90">{(pr as any).reason || "-"}</span>
            </div>
            {(pr as any).attachment_url && (
              <div className="col-span-2">
                <span className="block text-white/50 text-xs mb-1">Attachment</span>
                <a href={(pr as any).attachment_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  <FileText className="w-4 h-4" /> View Attachment
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-2">Items & Inventory Snapshot</h3>
          <div className="space-y-4">
            {items?.map((item: any, idx: number) => (
              <div key={item.id} className="bg-black/20 p-4 rounded-lg border border-white/5 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <strong className="text-blue-300 text-base">{idx + 1}. {item.products?.name}</strong>
                  <span className="font-medium bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Req: {item.quantity} {item.unit}</span>
                </div>
                {item.specification && (
                  <p className="text-white/60 text-xs mb-3">Spec: {item.specification}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-white/70">
                  <div>On Hand: {item.on_hand_at_request}</div>
                  <div>Allocated: {item.allocated_at_request}</div>
                  <div className="text-green-400 font-medium">Available: {item.available_at_request}</div>
                  <div className="text-orange-400 font-medium">Shortage: {item.purchase_shortage}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-4 mb-4">Quotations (เสนอราคา)</h3>
        <QuotationList 
          prId={id} 
          prStatus={(pr as any).status}
          selectedQuotationId={(pr as any).selected_quotation_id}
          initialQuotations={quotations || []} 
          suppliers={suppliers || []} 
        />
      </div>
    </div>
  )
}
