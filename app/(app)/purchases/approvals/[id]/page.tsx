import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ApprovalActions } from "./_components/approval-actions"

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const { data: authUser } = await supabase.auth.getUser()

  // Fetch PR
  const { data: pr } = await supabase
    .from<any, any>("purchase_requests")
    .select("*, projects(name), pr_quotations!selected_quotation_id(*, suppliers(name))")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!pr) return notFound()

  // Verify it has a selected quotation
  if (!(pr as any).selected_quotation_id || !(pr as any).pr_quotations) {
    // Cannot approve without a selected quotation
    return (
      <div className="p-8 text-center text-white">
        <h2 className="text-xl text-red-400 font-bold mb-2">Error</h2>
        <p>This Purchase Request does not have a selected quotation. Cannot proceed with approval.</p>
        <Button className="mt-4" render={<Link href="/purchases/approvals" />}>Back to Approvals</Button>
      </div>
    )
  }

  // Check if current user is the requester (prevent self-approval in UI, also handled by RLS if needed, but let's do UI logic first)
  const isRequester = authUser.user?.id === (pr as any).requested_by
  const quote = (pr as any).pr_quotations

  // Fetch Items
  const { data: items } = await supabase
    .from("purchase_request_items")
    .select("*, products(name)")
    .eq("pr_id", id)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: true })

  // Fetch Profiles for requester and selector
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [(pr as any).requested_by, (pr as any).selected_by].filter(Boolean))
  
  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]))
  const requesterName = profileMap.get((pr as any).requested_by) || "Unknown"
  const selectorName = profileMap.get((pr as any).selected_by) || "Unknown"

  // Fetch Approval Limits for current user
  const { data: limits } = await supabase
    .from("approval_limits")
    .select("*")
    .eq("user_id", authUser.user?.id || "")
    .eq("org_id", ctx.orgId)
    
  // If user has a limit, check if they can approve the amount (quote.price)
  let canApprove = false;
  if (limits && limits.length > 0) {
    // Sum of max_amount or just check if any row allows this amount
    canApprove = limits.some(l => Number(l.max_amount) >= Number(quote.price))
    // Also, usually admin or unlimited has high max_amount or special role
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/purchases/approvals" />}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <PageHeader
          title={`Approval Review: ${(pr as any).pr_number}`}
          description="ตรวจสอบรายละเอียดคำขอจัดซื้อ ข้อมูลสินค้าคงคลัง และผลการพิจารณา Supplier"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PR Info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-2">1. PR Information</h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <span className="block text-white/50 text-xs mb-1">Requester</span>
              <span className="text-white/90">{requesterName}</span>
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
              <span className="text-white/90 capitalize font-semibold text-yellow-300">{(pr as any).status}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-white/50 text-xs mb-1">Reason / Description</span>
              <span className="text-white/90">{(pr as any).reason || "-"}</span>
            </div>
          </div>
        </div>

        {/* Selected Quotation */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 space-y-4 relative">
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
            Selected by Procurement
          </div>
          <h3 className="font-semibold text-lg text-blue-300 border-b border-blue-500/20 pb-2">2. Procurement Decision</h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div className="col-span-2">
              <span className="block text-blue-300/70 text-xs mb-1">Supplier</span>
              <span className="text-white/90 font-medium text-base">{quote.suppliers?.name}</span>
            </div>
            <div>
              <span className="block text-blue-300/70 text-xs mb-1">Price (Total)</span>
              <span className="text-white/90">฿{Number(quote.price).toFixed(2)}</span>
            </div>
            <div>
              <span className="block text-blue-300/70 text-xs mb-1">Quotation No.</span>
              <span className="text-white/90">{quote.quotation_number || "-"}</span>
            </div>
            <div>
              <span className="block text-blue-300/70 text-xs mb-1">Lead Time</span>
              <span className="text-white/90">{quote.lead_time || "-"}</span>
            </div>
            <div>
              <span className="block text-blue-300/70 text-xs mb-1">Payment Term</span>
              <span className="text-white/90">{quote.payment_term || "-"}</span>
            </div>
            <div className="col-span-2 bg-black/30 p-3 rounded mt-2 border border-blue-500/20">
              <span className="block text-blue-300/70 text-xs mb-1">เหตุผลในการเลือก (Selection Reason)</span>
              <span className="text-blue-100 italic">"{(pr as any).selection_reason}"</span>
              <span className="block text-blue-300/50 text-[10px] mt-1">- โดย {selectorName} เมื่อ {new Date((pr as any).selected_at).toLocaleString()}</span>
            </div>
            {quote.attachment_url && (
              <div className="col-span-2 mt-2">
                <a href={quote.attachment_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 text-sm">
                  <FileText className="w-4 h-4" /> ดูเอกสารใบเสนอราคา
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Snapshot */}
        <div className="col-span-1 md:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-2">3. Items & Inventory Snapshot</h3>
          <div className="space-y-4">
            {items?.map((item: any, idx: number) => (
              <div key={item.id} className="bg-black/20 p-4 rounded-lg border border-white/5 text-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <strong className="text-white text-base block mb-1">{idx + 1}. {item.products?.name}</strong>
                    {item.specification && <span className="text-white/60 text-xs">Spec: {item.specification}</span>}
                  </div>
                  <span className="font-medium bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded">Req: {item.quantity} {item.unit}</span>
                </div>
                
                <div className="bg-white/5 p-3 rounded grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-white/80">
                  <div>
                    <span className="block text-white/50 mb-1">On Hand</span>
                    <span className="font-medium text-sm">{item.on_hand_at_request}</span>
                  </div>
                  <div>
                    <span className="block text-white/50 mb-1">Allocated</span>
                    <span className="font-medium text-sm">{item.allocated_at_request}</span>
                  </div>
                  <div>
                    <span className="block text-white/50 mb-1">Available</span>
                    <span className="font-medium text-sm text-green-400">{item.available_at_request}</span>
                  </div>
                  <div>
                    <span className="block text-white/50 mb-1">Purchase Shortage</span>
                    <span className="font-medium text-sm text-orange-400">{item.purchase_shortage}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(pr as any).status === 'pending_approval' ? (
        <ApprovalActions 
          prId={id} 
          isRequester={isRequester} 
          canApprove={canApprove} 
          price={quote.price} 
        />
      ) : (
        <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-center">
          <h3 className="text-lg font-bold text-white mb-2">PR Status: <span className="uppercase">{(pr as any).status}</span></h3>
          {(pr as any).status === 'approved' && (pr as any).approved_at && (
            <p className="text-green-400 text-sm">อนุมัติเมื่อ: {new Date((pr as any).approved_at).toLocaleString()}</p>
          )}
          {(pr as any).status === 'rejected' && (
            <p className="text-red-400 text-sm">เหตุผลที่ไม่อนุมัติ: {(pr as any).rejection_reason}</p>
          )}
          {(pr as any).status === 'revision_requested' && (
            <p className="text-orange-400 text-sm">สิ่งที่ต้องแก้ไข: {(pr as any).revision_reason}</p>
          )}
        </div>
      )}
    </div>
  )
}
