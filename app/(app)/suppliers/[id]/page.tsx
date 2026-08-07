import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, ShoppingCart } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/app/(app)/clients/_lib/format"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!supplier) notFound()

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, total_amount, expected_date")
    .eq("supplier_id", id)
    .order("created_at", { ascending: false })

  const purchaseOrders = pos ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} description="Supplier details">
        <Button variant="ghost" size="sm" render={<Link href="/suppliers" />}>
          <ArrowLeft />
          Back
        </Button>
        <Button variant="outline" size="sm" render={<Link href={`/suppliers/${supplier.id}/edit`} />}>
          <Pencil />
          Edit
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
          <Field label="Email" value={supplier.email} />
          <Field label="Phone" value={supplier.phone} />
          <Field label="Tax ID" value={supplier.tax_id} />
          <Field label="Added" value={formatDate(supplier.created_at)} />
          {supplier.address && (
            <div className="sm:col-span-2 space-y-1">
              <p className="text-muted-foreground text-xs font-medium">Address</p>
              <p className="text-sm whitespace-pre-wrap">{supplier.address}</p>
            </div>
          )}
          {supplier.notes && (
            <div className="sm:col-span-2 space-y-1">
              <p className="text-muted-foreground text-xs font-medium">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-4" /> Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No POs yet"
              description="You haven't ordered anything from this supplier."
              className="border-0 p-6"
            />
          ) : (
            <ul className="divide-y">
              {purchaseOrders.map((po) => (
                <li key={po.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/purchases/${po.id}`} className="font-medium hover:underline text-primary">
                    {po.po_number}
                  </Link>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">฿{po.total_amount.toFixed(2)}</span>
                    <Badge variant="outline" className="capitalize">{po.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  )
}
