import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, User, Truck, Receipt, Package, MapPin } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OrderStatusBadge } from "../_components/status-badge"
import { OrderItemsTable } from "./_components/order-items-table"
import { formatDate } from "@/app/(app)/clients/_lib/format"
import { formatTHB } from "@/lib/money"
import { updateOrderStatus } from "../actions"

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const [orderRes, itemsRes, productsRes, locationsRes] = await Promise.all([
    supabase.from("sales_orders").select("*, sales_channels(name)").eq("id", id).eq("org_id", ctx.orgId).maybeSingle(),
    supabase.from("sales_order_items").select("*, products(name, barcode)").eq("order_id", id).order("created_at"),
    supabase.from("products").select("id, name, price, stock_quantity, barcode").order("name"),
    supabase.from("inventory_locations").select("id, name").eq("org_id", ctx.orgId).order("name")
  ])

  const order = orderRes.data
  const items = itemsRes.data ?? []
  const products = productsRes.data ?? []
  const locations = locationsRes?.data ?? []

  if (!order) notFound()

  const isEditable = order.status === "pending"

  return (
    <div className="space-y-6">
      <PageHeader title={order.order_number} description={(order.sales_channels as any)?.name || "Direct Sale"}>
        <Button variant="ghost" size="sm" render={<Link href="/sales" />}>
          <ArrowLeft /> Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Package className="size-4" /> Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderItemsTable 
                orderId={order.id} 
                items={items as any} 
                products={products}
                locations={locations}
                isEditable={isEditable}
                totalAmount={order.total_amount}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><User className="size-4" /> Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Name</p>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Phone</p>
                  <p>{order.customer_phone || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground font-medium text-xs flex items-center gap-1"><MapPin className="size-3" /> Shipping Address</p>
                <p className="whitespace-pre-wrap mt-1">{order.shipping_address || "—"}</p>
              </div>
              {order.notes && (
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Notes</p>
                  <p className="whitespace-pre-wrap mt-1 text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="size-4" /> Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                <OrderStatusBadge status={order.status || "pending"} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Date</span>
                <span className="text-sm">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Payment</span>
                <span className="text-sm uppercase">{order.payment_method?.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold text-emerald-600 text-lg">{formatTHB(order.total_amount * 100)}</span>
              </div>
              
              <div className="pt-4 space-y-2 border-t mt-4">
                {order.status === "pending" && (
                  <form action={async () => { "use server"; await updateOrderStatus(order.id, "paid") }}>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" type="submit">Mark as Paid</Button>
                  </form>
                )}
                {(order.status === "paid" || order.status === "packing") && (
                  <form action={async () => { "use server"; await updateOrderStatus(order.id, "shipped") }}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" type="submit">Mark as Shipped</Button>
                  </form>
                )}
                {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "shipped" && (
                  <form action={async () => { "use server"; await updateOrderStatus(order.id, "cancelled") }}>
                    <Button variant="outline" className="w-full text-destructive" type="submit">Cancel Order</Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          {(order.status === "shipped" || order.status === "delivered" || order.tracking_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Truck className="size-4" /> Shipping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Courier</p>
                  <p className="font-medium">{order.courier || "Standard Delivery"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium text-xs">Tracking Number</p>
                  <p className="font-mono">{order.tracking_number || "—"}</p>
                </div>
                {order.status === "shipped" && (
                  <form action={async () => { "use server"; await updateOrderStatus(order.id, "delivered") }} className="pt-3">
                    <Button variant="outline" size="sm" className="w-full" type="submit">Confirm Delivery</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
