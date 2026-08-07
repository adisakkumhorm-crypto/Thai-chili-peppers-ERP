import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SupplierForm } from "../_components/supplier-form"
import { createSupplier } from "../actions"

export default function NewSupplierPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="New supplier" description="Add a new vendor or supplier.">
        <Button variant="ghost" size="sm" render={<Link href="/suppliers" />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <SupplierForm
            action={createSupplier}
            submitLabel="Create supplier"
            redirectsOnSuccess
          />
        </CardContent>
      </Card>
    </div>
  )
}
