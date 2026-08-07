import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProductForm } from "../_components/product-form"
import { updateProduct } from "../actions"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!product) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Edit product" description={`Update details for ${product.name}.`}>
        <Button variant="ghost" size="sm" render={<Link href="/products" />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <ProductForm
            action={updateProduct.bind(null, product.id)}
            defaultValues={{
              ...product,
              sku: product.sku ?? undefined,
              description: product.description ?? undefined,
            }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  )
}
