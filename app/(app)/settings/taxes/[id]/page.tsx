import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect, notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { TaxForm } from "../_components/tax-form"
import { updateTaxRate } from "@/lib/accounting/tax-actions"

export const dynamic = "force-dynamic"

export default async function EditTaxRatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: taxRate } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!taxRate) {
    notFound()
  }

  async function action(payload: Parameters<typeof updateTaxRate>[1]) {
    "use server"
    await updateTaxRate(id, payload)
    redirect("/settings/taxes")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Tax Rate"
        description={`แก้ไขข้อมูลอัตราภาษี ${taxRate.name}`}
      >
        <Button variant="outline" render={<Link href="/settings/taxes" />}>
          <ArrowLeft /> Back to Taxes
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดภาษี</CardTitle>
          <CardDescription>
            ปรับปรุงชื่อ ประเภท และอัตราภาษี
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxForm defaultValues={taxRate} action={action} />
        </CardContent>
      </Card>
    </div>
  )
}
