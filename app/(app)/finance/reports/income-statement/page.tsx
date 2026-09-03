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
import { format, parseISO } from "date-fns"
import { th } from "date-fns/locale"

export const dynamic = "force-dynamic"

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  // For simplicity, we get the current month in YYYY-MM if not provided
  const { month } = await searchParams
  const today = new Date()
  const targetMonth = month || format(today, "yyyy-MM")
  
  const startDate = `${targetMonth}-01`
  const endOfMonth = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0)
  const endDate = format(endOfMonth, "yyyy-MM-dd")

  // Fetch journal entries for the month
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("org_id", ctx.orgId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)

  const entryIds = (entries || []).map(e => e.id)
  
  const accountBalances: Record<string, { name: string, type: string, amount: number }> = {}

  if (entryIds.length > 0) {
    const { data: lines } = await supabase
      .from("journal_entry_lines")
      .select("account_id, debit_amount_satang, credit_amount_satang, accounts(name, type, code)")
      .in("entry_id", entryIds)
      
    if (lines) {
      lines.forEach(line => {
        const type = line.accounts?.type
        if (type === 'revenue' || type === 'expense') {
          const code = line.accounts?.code || '0000'
          const name = line.accounts?.name || 'Unknown'
          
          if (!accountBalances[code]) {
            accountBalances[code] = { name, type, amount: 0 }
          }
          
          // For Revenue: Credit increases balance, Debit decreases
          // For Expense: Debit increases balance, Credit decreases
          if (type === 'revenue') {
            accountBalances[code].amount += (line.credit_amount_satang - line.debit_amount_satang)
          } else if (type === 'expense') {
            accountBalances[code].amount += (line.debit_amount_satang - line.credit_amount_satang)
          }
        }
      })
    }
  }

  const revenueList = Object.keys(accountBalances)
    .filter(k => accountBalances[k].type === 'revenue')
    .sort()
    .map(k => ({ code: k, ...accountBalances[k] }))
    
  const expenseList = Object.keys(accountBalances)
    .filter(k => accountBalances[k].type === 'expense')
    .sort()
    .map(k => ({ code: k, ...accountBalances[k] }))

  const totalRevenue = revenueList.reduce((acc, item) => acc + item.amount, 0)
  const totalExpense = expenseList.reduce((acc, item) => acc + item.amount, 0)
  const netIncome = totalRevenue - totalExpense

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`งบกำไรขาดทุน (Income Statement) - ${format(new Date(startDate), "MMMM yyyy", { locale: th })}`} 
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">รายได้รวม (Total Revenue)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatTHB(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ค่าใช้จ่ายรวม (Total Expenses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatTHB(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card className={netIncome >= 0 ? "bg-green-50/50 dark:bg-green-950/50" : "bg-red-50/50 dark:bg-red-950/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">กำไร (ขาดทุน) สุทธิ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
              {formatTHB(netIncome)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดงบกำไรขาดทุน</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสบัญชี</TableHead>
                <TableHead>ชื่อบัญชี</TableHead>
                <TableHead className="text-right">จำนวนเงิน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* รายได้ */}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold">รายได้ (Revenues)</TableCell>
              </TableRow>
              {revenueList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-2 text-sm">ไม่มีรายการรายได้</TableCell>
                </TableRow>
              ) : (
                revenueList.map(item => (
                  <TableRow key={item.code}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{formatTHB(item.amount)}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell colSpan={2} className="font-bold text-right">รวมรายได้</TableCell>
                <TableCell className="text-right font-bold text-green-600">{formatTHB(totalRevenue)}</TableCell>
              </TableRow>

              {/* ค่าใช้จ่าย */}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold mt-4">ค่าใช้จ่าย (Expenses)</TableCell>
              </TableRow>
              {expenseList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-2 text-sm">ไม่มีรายการค่าใช้จ่าย</TableCell>
                </TableRow>
              ) : (
                expenseList.map(item => (
                  <TableRow key={item.code}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{formatTHB(item.amount)}</TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell colSpan={2} className="font-bold text-right">รวมค่าใช้จ่าย</TableCell>
                <TableCell className="text-right font-bold text-red-600">{formatTHB(totalExpense)}</TableCell>
              </TableRow>
              
              {/* สุทธิ */}
              <TableRow className="bg-muted border-t-2 border-black dark:border-white">
                <TableCell colSpan={2} className="font-bold text-right text-lg">กำไร (ขาดทุน) สุทธิ</TableCell>
                <TableCell className={`text-right font-bold text-lg ${netIncome >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                  {formatTHB(netIncome)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
