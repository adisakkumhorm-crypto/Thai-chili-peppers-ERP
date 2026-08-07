import Link from "next/link"
import { ShoppingCart, Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/app/(app)/clients/_lib/format"

export const dynamic = "force-dynamic"

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { q: qParam } = await searchParams
  const q = (qParam ?? "").trim()

  let query = supabase
    .from("purchase_orders")
    .select("id, po_number, status, total_amount, expected_date, suppliers(name)")
    .order("created_at", { ascending: false })
    
  if (q) query = query.ilike("po_number", `%${q}%`)

  const { data: pos } = await query

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Manage your orders to suppliers and track incoming stock."
      >
        <Button render={<Link href="/purchases/new" />}>
          <Plus />
          New PO
        </Button>
      </PageHeader>

      {!pos || pos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={q ? "No matching POs" : "No purchase orders yet"}
          description={
            q
              ? "No POs match your search. Try a different number."
              : "Create your first Purchase Order to restock products."
          }
          action={
            !q ? (
              <Button render={<Link href="/purchases/new" />}>
                <Plus />
                New PO
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((po) => {
                // Determine badge variant based on status
                let badgeVariant: "default" | "secondary" | "outline" | "destructive" = "outline"
                if (po.status === "ordered") badgeVariant = "default"
                if (po.status === "received") badgeVariant = "secondary" // or success if we had it
                if (po.status === "cancelled") badgeVariant = "destructive"

                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/purchases/${po.id}`}
                        className="hover:underline text-primary"
                      >
                        {po.po_number}
                      </Link>
                    </TableCell>
                    <TableCell>{(po.suppliers as any)?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(po.expected_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant} className="capitalize">{po.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      ฿{po.total_amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
