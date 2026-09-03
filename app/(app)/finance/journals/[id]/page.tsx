import Link from "next/link"
import { ArrowLeft, BookText } from "lucide-react"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { formatTHB } from "@/lib/money"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
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

export const dynamic = "force-dynamic"

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { data: journal } = await supabase
    .from("journal_entries")
    .select(`
      *,
      lines:journal_entry_lines(
        *,
        account:accounts(code, name)
      )
    `)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single()

  if (!journal) {
    notFound()
  }

  // Calculate totals
  
  const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit_amount_satang, 0)
  
  const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit_amount_satang, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Journal: ${journal.entry_number}`}
        description={journal.description}
      >
        <Button variant="outline" render={<Link href="/finance?status=journals" />}>
          <ArrowLeft /> Back to Finance
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลใบสำคัญ</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">วันที่ (Date)</dt>
                <dd className="font-medium">{journal.entry_date}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">เลขที่ (No.)</dt>
                <dd className="font-medium">{journal.entry_number}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">ที่มา (Source)</dt>
                <dd className="font-medium capitalize">{journal.source}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">สถานะ (Status)</dt>
                <dd className="font-medium capitalize">{journal.status}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">รายการบัญชี (Lines)</CardTitle>
            <CardDescription>เดบิตและเครดิต</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>บัญชี (Account)</TableHead>
                  <TableHead>คำอธิบาย (Description)</TableHead>
                  <TableHead className="text-right">เดบิต (Debit)</TableHead>
                  <TableHead className="text-right">เครดิต (Credit)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                {journal.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">
                      {line.account?.code} - {line.account?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.debit_amount_satang > 0 ? formatTHB(line.debit_amount_satang) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.credit_amount_satang > 0 ? formatTHB(line.credit_amount_satang) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-[1fr_120px_120px] gap-4 p-4 mt-4 bg-muted/30 border rounded-md">
              <div className="text-right font-medium text-sm">ยอดรวม (Total)</div>
              <div className="text-right font-bold tabular-nums">{formatTHB(totalDebit)}</div>
              <div className="text-right font-bold tabular-nums">{formatTHB(totalCredit)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
