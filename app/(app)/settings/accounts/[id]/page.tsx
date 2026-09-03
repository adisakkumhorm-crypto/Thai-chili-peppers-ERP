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
import { AccountForm } from "../_components/account-form"
import { updateAccount } from "@/lib/accounting/account-actions"

export const dynamic = "force-dynamic"

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!account) {
    notFound()
  }

  async function action(payload: Parameters<typeof updateAccount>[1]) {
    "use server"
    await updateAccount(id, payload)
    redirect("/settings/accounts")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Account"
        description={`แก้ไขข้อมูลบัญชีรหัส ${account.code}`}
      >
        <Button variant="outline" render={<Link href="/settings/accounts" />}>
          <ArrowLeft /> Back to Accounts
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดบัญชี</CardTitle>
          <CardDescription>
            ปรับปรุงชื่อและหมวดหมู่ของบัญชี
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm defaultValues={{ ...account, description: account.description ?? undefined }} action={action} />
        </CardContent>
      </Card>
    </div>
  )
}
