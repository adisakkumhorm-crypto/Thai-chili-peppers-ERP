import Link from "next/link"
import { ArrowLeft, BookText, Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import type { Database } from "@/lib/types/database"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { getAccounts } from "@/lib/accounting/account-actions"

export const dynamic = "force-dynamic"

const ACCOUNT_TYPE_LABELS: Record<Database["public"]["Enums"]["account_type"], string> = {
  asset: "สินทรัพย์ (Asset)",
  liability: "หนี้สิน (Liability)",
  equity: "ส่วนของเจ้าของ (Equity)",
  revenue: "รายได้ (Revenue)",
  expense: "ค่าใช้จ่าย (Expense)",
}

export default async function AccountsPage() {
  const ctx = await requireOrgContext()
  const accounts = await getAccounts(ctx.orgId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="ผังบัญชี - จัดการหมวดหมู่บัญชีสำหรับบันทึกรายการ"
      >
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/settings" />}>
            <ArrowLeft /> Settings
          </Button>
          <Button>
            <Plus /> New Account
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts (ผังบัญชี)</CardTitle>
          <CardDescription>
            รายการบัญชีทั้งหมดในระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState
              icon={BookText}
              title="ยังไม่มีผังบัญชี"
              description="สร้างผังบัญชีแรกเพื่อเริ่มต้นบันทึกรายการบัญชี"
              action={
                <Button>
                  <Plus /> New Account
                </Button>
              }
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสบัญชี (Code)</TableHead>
                  <TableHead>ชื่อบัญชี (Name)</TableHead>
                  <TableHead>หมวดบัญชี (Type)</TableHead>
                  <TableHead>รายละเอียด (Description)</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.code}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell>{ACCOUNT_TYPE_LABELS[acc.type]}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.description ?? "-"}</TableCell>
                    <TableCell>
                      {acc.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
