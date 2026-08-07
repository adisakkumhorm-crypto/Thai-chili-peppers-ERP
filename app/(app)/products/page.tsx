import Link from "next/link"
import { Package, Plus } from "lucide-react"

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

export const dynamic = "force-dynamic"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { q: qParam } = await searchParams
  const q = (qParam ?? "").trim()

  let query = supabase
    .from("products")
    .select("id, name, sku, price, stock_quantity, created_at")
    .order("name", { ascending: true })
  if (q) query = query.ilike("name", `%${q}%`)

  const { data: products } = await query
  const hasProducts = (products?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Inventory"
        description="Manage your products, SKUs, pricing, and stock levels."
      >
        <Button render={<Link href="/products/new" />}>
          <Plus />
          New product
        </Button>
      </PageHeader>

      {!products || products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? "No matching products" : "No products yet"}
          description={
            q
              ? "No products match your search. Try a different name."
              : "Start building your inventory by adding your first product."
          }
          action={
            !q ? (
              <Button render={<Link href="/products/new" />}>
                <Plus />
                New product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/products/${p.id}`}
                      className="hover:underline text-primary"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.sku || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    ฿{p.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {p.stock_quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
