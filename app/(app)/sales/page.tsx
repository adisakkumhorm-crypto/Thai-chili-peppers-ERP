import Link from "next/link"
import { Plus, Store, ShoppingBag } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { OrderStatusBadge } from "./_components/status-badge"
import { formatDate } from "@/app/(app)/clients/_lib/format"
import { formatTHB } from "@/lib/money"

export const dynamic = "force-dynamic"

export default async function SalesPage() {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/sales")
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from("sales_orders")
    .select("*, sales_channels(name)")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })

  const os = orders ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Online Sales (E-Commerce)" description="Manage orders from TikTok, Shopee, Facebook, etc.">
        <Button render={<Link href="/sales/new" />}>
          <Plus data-icon="inline-start" /> New Order
        </Button>
      </PageHeader>

      {os.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No online orders yet"
          description="Create an order manually or integrate via API."
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-4 font-medium">Order Number</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Channel</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {os.map(o => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <Link href={`/sales/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="p-4 text-muted-foreground">{formatDate(o.created_at)}</td>
                  <td className="p-4 font-medium">{o.customer_name}</td>
                  <td className="p-4">
                    <span className="bg-muted px-2 py-1 rounded text-xs border">
                      {(o.sales_channels as any)?.name || "Direct"}
                    </span>
                  </td>
                  <td className="p-4">
                    <OrderStatusBadge status={o.status || "pending"} />
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600">
                    {formatTHB(o.total_amount * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
