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
import { AccountForm } from "../_components/account-form"
import { createAccount } from "@/lib/accounting/account-actions"

export const dynamic = "force-dynamic"

export default async function NewAccountPage() {
  const ctx = await requireOrgContext()

  async function action(payload: Parameters<typeof createAccount>[1]) {
    "use server"
    await createAccount(ctx.orgId, payload)
    redirect("/settings/accounts")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Account"
        description="เพิ่มหมวดหมู่บัญชีใหม่ลงในผังบัญชี"
      >
        <Button variant="outline" render={<Link href="/settings/accounts" />}>
          <ArrowLeft /> Back to Accounts
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดบัญชี</CardTitle>
          <CardDescription>
            กำหนดรหัส ชื่อ และหมวดหมู่หลักของบัญชี
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm action={action} />
        </CardContent>
      </Card>
    </div>
  )
}
