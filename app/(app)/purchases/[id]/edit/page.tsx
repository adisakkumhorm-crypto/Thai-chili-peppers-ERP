import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { POForm } from "../../_components/po-form"
import { updatePO } from "../../actions"

export default async function EditPOPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const [poRes, suppliersRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single(),
    supabase.from("suppliers").select("id, name").order("name"),
  ])

  const po = poRes.data
  const suppliers = suppliersRes.data ?? []

  if (!po) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Edit PO" description={`Update details for ${po.po_number}.`}>
        <Button variant="ghost" size="sm" render={<Link href={`/purchases/${id}`} />}>
          <ArrowLeft />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <POForm
            action={updatePO.bind(null, po.id)}
            suppliers={suppliers}
            defaultValues={{
              ...po,
              expected_date: po.expected_date ?? undefined,
              notes: po.notes ?? undefined,
            }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  )
}
