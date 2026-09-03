import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, Truck, CheckCircle2, FileText, XCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/app/(app)/clients/_lib/format"
import { POStatusBadge } from "../_components/po-status-badge"
import { POItemsTable } from "./_components/po-items-table"
import { PrintPOButton } from "./_components/print-po-button"
import { ReceivePODialog } from "./_components/receive-po-dialog"
import { CreateBillButton } from "./_components/create-bill-button"
import { updatePOStatus, requestPOApproval, approvePO } from "../actions"

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const [poRes, itemsRes, productsRes, projectsRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name, email)")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("*, products(name, sku), projects(name)")
      .eq("po_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("id, name, cost").order("name"),
    supabase.from("projects").select("id, name").in("status", ["not_started", "in_progress"]).order("name"),
  ])

  const po = poRes.data
  
  const userIds = [po?.requested_by, po?.approved_by].filter(Boolean) as string[]
  const { data: profiles } = userIds.length > 0 
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] }
    
  const requestedBy = profiles?.find(p => p.id === po?.requested_by)?.full_name || "Unknown"
  const approvedBy = profiles?.find(p => p.id === po?.approved_by)?.full_name || "Unknown"
  const items = itemsRes.data ?? []
  const products = productsRes.data ?? []
  const projects = projectsRes?.data ?? []

  if (!po) notFound()

  const isEditable = po.status !== "received" && po.status !== "cancelled"

  return (
    <div className="space-y-6">
      <PageHeader title={po.po_number} description="Purchase Order Details">
        <Button variant="ghost" size="sm" render={<Link href="/purchases" />} className="print:hidden">
          <ArrowLeft />
          Back
        </Button>
        {isEditable && (
          <Button variant="outline" size="sm" render={<Link href={`/purchases/${po.id}/edit`} />} className="print:hidden">
            <Pencil />
            Edit
          </Button>
        )}
        <PrintPOButton />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" /> Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <POItemsTable 
                poId={po.id} 
                items={items as any} 
                products={products}
                projects={projects}
                isEditable={isEditable}
                totalAmount={po.total_amount}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                <POStatusBadge status={po.status} />
              </div>
              {po.requested_by && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Requested By</span>
                  <span className="text-sm font-medium">{requestedBy}</span>
                </div>
              )}
              {po.approved_by && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Approved By</span>
                  <span className="text-sm font-medium">{approvedBy}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-semibold">฿{po.total_amount.toFixed(2)}</span>
              </div>
              
              {isEditable && (
                <div className="pt-4 space-y-2 border-t mt-4 print:hidden">
                  {po.status === "draft" && (
                    <form action={async () => {
                      "use server"
                      await requestPOApproval(po.id)
                    }}>
                      <Button className="w-full" type="submit">Request Approval</Button>
                    </form>
                  )}
                  {po.status === "pending_approval" && (
                    <form action={async () => {
                      "use server"
                      await approvePO(po.id)
                    }}>
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white" type="submit">Approve Order</Button>
                    </form>
                  )}
                  {(po.status === "ordered" || po.status === "partially_received") && (
                    <ReceivePODialog poId={po.id} items={items as any} />
                  )}
                  {(po.status === "partially_received" || po.status === "received") && (
                    <CreateBillButton poId={po.id} />
                  )}
                  <form action={async () => {
                    "use server"
                    await updatePOStatus(po.id, "cancelled")
                  }}>
                    <Button variant="outline" className="w-full text-destructive" type="submit">
                      Cancel Order
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="size-4" /> Supplier Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground font-medium text-xs">Name</p>
                <Link href={`/suppliers/${(po.suppliers as any).id}`} className="hover:underline text-primary">
                  {(po.suppliers as any).name}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground font-medium text-xs">Expected Delivery</p>
                <p>{formatDate(po.expected_date)}</p>
              </div>
              {po.notes && (
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Notes</p>
                  <p className="whitespace-pre-wrap">{po.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
