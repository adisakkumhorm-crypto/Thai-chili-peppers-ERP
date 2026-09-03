import Link from "next/link"
import { ArrowLeft, Percent, Plus } from "lucide-react"

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
import { getTaxRates } from "@/lib/accounting/tax-actions"

export const dynamic = "force-dynamic"

const TAX_TYPE_LABELS: Record<Database["public"]["Enums"]["tax_type"], string> = {
  vat: "ภาษีมูลค่าเพิ่ม (VAT)",
  wht: "ภาษีหัก ณ ที่จ่าย (WHT)",
}

export default async function TaxesPage() {
  const ctx = await requireOrgContext()
  const taxRates = await getTaxRates(ctx.orgId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Rates"
        description="ตั้งค่าภาษี - อัตราภาษีมูลค่าเพิ่มและภาษีหัก ณ ที่จ่าย"
      >
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/settings" />}>
            <ArrowLeft /> Settings
          </Button>
          <Button render={<Link href="/settings/taxes/new" />}>
            <Plus /> New Tax Rate
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax Rates (อัตราภาษี)</CardTitle>
          <CardDescription>
            อัตราภาษีที่ใช้ในระบบซื้อและขาย
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taxRates.length === 0 ? (
            <EmptyState
              icon={Percent}
              title="ยังไม่มีการตั้งค่าภาษี"
              description="เพิ่มอัตราภาษีเพื่อนำไปใช้คำนวณในใบแจ้งหนี้และใบสั่งซื้อ"
              action={
                <Button render={<Link href="/settings/taxes/new" />}>
                  <Plus /> New Tax Rate
                </Button>
              }
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อภาษี (Name)</TableHead>
                  <TableHead>ประเภท (Type)</TableHead>
                  <TableHead className="text-right">อัตรา (Rate %)</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map((tax) => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">
                      <Link href={`/settings/taxes/${tax.id}`} className="hover:underline">
                        {tax.name}
                      </Link>
                    </TableCell>
                    <TableCell>{TAX_TYPE_LABELS[tax.type]}</TableCell>
                    <TableCell className="text-right">{Number(tax.rate).toFixed(2)}%</TableCell>
                    <TableCell>
                      {tax.is_active ? (
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
