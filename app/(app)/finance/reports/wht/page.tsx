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

export const dynamic = "force-dynamic"

export default async function WhtReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  const { month } = await searchParams
  const today = new Date()
  const targetMonth = month || format(today, "yyyy-MM")
  
  const startDate = `${targetMonth}-01`
  const endOfMonth = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0)
  const endDate = format(endOfMonth, "yyyy-MM-dd")

  // Fetch Costs with WHT
  const { data: costs } = await supabase
    .from("costs")
    .select("id, category, incurred_on, subtotal_satang, wht_amount_satang, vendor, suppliers(name, tax_id)")
    .eq("org_id", ctx.orgId)
    .gt("wht_amount_satang", 0)
    .gte("incurred_on", startDate)
    .lte("incurred_on", endDate)
    .order("incurred_on", { ascending: true })

  const whtItems = (costs || []).map(c => ({
    id: c.id,
    date: c.incurred_on,
    vendorName: c.vendor || c.suppliers?.name || "Unknown",
    taxId: c.suppliers?.tax_id || "—",
    subtotal: c.subtotal_satang,
    whtAmount: c.wht_amount_satang,
  }))

  const totalSubtotal = whtItems.reduce((sum, item) => sum + item.subtotal, 0)
  const totalWht = whtItems.reduce((sum, item) => sum + item.whtAmount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / ภ.ง.ด.53)"
        description={`ประจำเดือน ${targetMonth}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการหัก ณ ที่จ่าย (จากค่าใช้จ่าย)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>ผู้ถูกหักภาษี (Vendor)</TableHead>
                <TableHead>เลขประจำตัวผู้เสียภาษี</TableHead>
                <TableHead className="text-right">จำนวนเงินที่จ่าย (ก่อนภาษี)</TableHead>
                <TableHead className="text-right">ภาษีที่หักไว้</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whtItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ไม่มีรายการหัก ณ ที่จ่ายในเดือนนี้
                  </TableCell>
                </TableRow>
              ) : (
                whtItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.vendorName}</TableCell>
                    <TableCell>{item.taxId}</TableCell>
                    <TableCell className="text-right">{formatTHB(item.subtotal)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {formatTHB(item.whtAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {whtItems.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">รวมยอดเงินที่จ่าย</dt>
                  <dd className="text-lg font-medium">{formatTHB(totalSubtotal)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">รวมภาษีหัก ณ ที่จ่ายนำส่ง</dt>
                  <dd className="text-lg font-bold text-red-600">{formatTHB(totalWht)}</dd>
                </div>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
