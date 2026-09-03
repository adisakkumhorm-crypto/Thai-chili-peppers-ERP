import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { formatTHB } from "@/lib/money"
import { format } from "date-fns"
import { th } from "date-fns/locale"

export const dynamic = "force-dynamic"

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { month } = await searchParams
  const today = new Date()
  const targetMonth = month || format(today, "yyyy-MM")
  
  const endOfMonth = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0)
  const endDate = format(endOfMonth, "yyyy-MM-dd")

  // Fetch all accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("org_id", ctx.orgId)
    .order("code")

  // Fetch all journal lines up to the end of the target month
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("account_id, debit_amount_satang, credit_amount_satang, journal_entries!inner(entry_date)")
    .eq("journal_entries.org_id", ctx.orgId)
    .lte("journal_entries.entry_date", endDate)

  const balances: Record<string, { debit: number, credit: number }> = {}
  
  if (lines) {
    lines.forEach(line => {
      if (!balances[line.account_id]) {
        balances[line.account_id] = { debit: 0, credit: 0 }
      }
      balances[line.account_id].debit += line.debit_amount_satang
      balances[line.account_id].credit += line.credit_amount_satang
    })
  }

  const tbItems = (accounts || []).map(acc => {
    const b = balances[acc.id] || { debit: 0, credit: 0 }
    
    // Normal balances:
    // Assets & Expenses = Debit balance
    // Liabilities, Equity, Revenue = Credit balance
    let finalDebit = 0
    let finalCredit = 0
    
    if (acc.type === 'asset' || acc.type === 'expense') {
      const net = b.debit - b.credit
      if (net >= 0) finalDebit = net
      else finalCredit = Math.abs(net)
    } else {
      const net = b.credit - b.debit
      if (net >= 0) finalCredit = net
      else finalDebit = Math.abs(net)
    }

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: finalDebit,
      credit: finalCredit
    }
  }).filter(item => item.debit > 0 || item.credit > 0) // Only show accounts with balances

  const totalDebit = tbItems.reduce((sum, item) => sum + item.debit, 0)
  const totalCredit = tbItems.reduce((sum, item) => sum + item.credit, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="งบทดลอง (Trial Balance)"
        description={`ณ วันสิ้นเดือน ${targetMonth}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ยอดคงเหลือทางบัญชี</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">รหัสบัญชี</TableHead>
                <TableHead>ชื่อบัญชี</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">เดบิต (Debit)</TableHead>
                <TableHead className="text-right">เครดิต (Credit)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tbItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ไม่มียอดเคลื่อนไหวทางบัญชี
                  </TableCell>
                </TableRow>
              ) : (
                tbItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{item.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.debit > 0 ? formatTHB(item.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.credit > 0 ? formatTHB(item.credit) : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {tbItems.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 text-right font-bold pt-2">
                  รวมทั้งสิ้น (Total)
                </div>
                <div className={`text-right font-bold pt-2 border-double border-b-4 ${totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {formatTHB(totalDebit)}
                </div>
                <div className={`text-right font-bold pt-2 border-double border-b-4 ${totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {formatTHB(totalCredit)}
                </div>
              </div>
              {totalDebit !== totalCredit && (
                <div className="mt-2 text-right text-sm font-semibold text-red-600">
                  ⚠️ ยอดเดบิตและเครดิตไม่สมดุลกัน (ผลต่าง: {formatTHB(Math.abs(totalDebit - totalCredit))})
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
