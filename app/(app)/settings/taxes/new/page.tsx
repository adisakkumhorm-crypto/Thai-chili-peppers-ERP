import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"

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
import { createTaxRate } from "@/lib/accounting/tax-actions"

export const dynamic = "force-dynamic"

export default async function NewTaxRatePage() {
  const ctx = await requireOrgContext()

  async function action(payload: Parameters<typeof createTaxRate>[1]) {
    "use server"
    await createTaxRate(ctx.orgId, payload)
    redirect("/settings/taxes")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Tax Rate"
        description="เพิ่มอัตราภาษีใหม่"
      >
        <Button variant="outline" render={<Link href="/settings/taxes" />}>
          <ArrowLeft /> Back to Taxes
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดภาษี</CardTitle>
          <CardDescription>
            กำหนดชื่อ ประเภท และอัตราภาษี (เปอร์เซ็นต์)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxForm action={action} />
        </CardContent>
      </Card>
    </div>
  )
}
