import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProductForm } from "../_components/product-form"
import { createProduct } from "../actions"

export default function NewProductPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="New product" description="Add a new item to your inventory.">
        <Button variant="ghost" size="sm" render={<Link href="/products" />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <ProductForm
            action={createProduct}
            submitLabel="Create product"
            redirectsOnSuccess
          />
        </CardContent>
      </Card>
    </div>
  )
}
