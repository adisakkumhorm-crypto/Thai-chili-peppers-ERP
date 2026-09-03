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
import { JournalForm } from "../_components/journal-form"
import { createManualJournalEntry } from "@/lib/accounting/journal-actions"
import { getAccounts } from "@/lib/accounting/account-actions"

export const dynamic = "force-dynamic"

export default async function NewJournalPage() {
  const ctx = await requireOrgContext()
  const accounts = await getAccounts(ctx.orgId)

  async function action(payload: Parameters<typeof createManualJournalEntry>[1]) {
    "use server"
    await createManualJournalEntry(ctx.orgId, payload)
    redirect("/finance?status=journals") // Redirect back to finance journals tab
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Journal Entry"
        description="บันทึกสมุดรายวันทั่วไป (Manual Journal Entry)"
      >
        <Button variant="outline" render={<Link href="/finance?status=journals" />}>
          <ArrowLeft /> Back to Finance
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดสมุดรายวัน</CardTitle>
          <CardDescription>
            บันทึกรายการบัญชี เดบิต/เครดิต (ยอดรวมเดบิตต้องเท่ากับเครดิต)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JournalForm accounts={accounts} action={action} />
        </CardContent>
      </Card>
    </div>
  )
}
