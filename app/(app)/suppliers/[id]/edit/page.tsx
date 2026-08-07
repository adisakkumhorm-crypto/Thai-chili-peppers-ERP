import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SupplierForm } from "../../_components/supplier-form"
import { updateSupplier } from "../../actions"

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!supplier) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Edit supplier" description={`Update details for ${supplier.name}.`}>
        <Button variant="ghost" size="sm" render={<Link href={`/suppliers/${id}`} />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <SupplierForm
            action={updateSupplier.bind(null, supplier.id)}
            defaultValues={{
              ...supplier,
              email: supplier.email ?? undefined,
              phone: supplier.phone ?? undefined,
              tax_id: supplier.tax_id ?? undefined,
              address: supplier.address ?? undefined,
              notes: supplier.notes ?? undefined,
            }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  )
}
