import Link from "next/link"
import { Truck, Plus } from "lucide-react"

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

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { q: qParam } = await searchParams
  const q = (qParam ?? "").trim()

  let query = supabase
    .from("suppliers")
    .select("id, name, email, phone, created_at")
    .order("name", { ascending: true })
  if (q) query = query.ilike("name", `%${q}%`)

  const { data: suppliers } = await query
  const hasSuppliers = (suppliers?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage vendors you buy products or materials from."
      >
        <Button render={<Link href="/suppliers/new" />}>
          <Plus />
          New supplier
        </Button>
      </PageHeader>

      {!suppliers || suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={q ? "No matching suppliers" : "No suppliers yet"}
          description={
            q
              ? "No suppliers match your search. Try a different name."
              : "Add your first supplier to start creating purchase orders."
          }
          action={
            !q ? (
              <Button render={<Link href="/suppliers/new" />}>
                <Plus />
                New supplier
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="hover:underline text-primary"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.phone || "—"}
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
