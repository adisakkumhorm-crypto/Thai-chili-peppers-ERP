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

export default async function VatReportPage({
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
  // A simple way to get end of month is to add 1 month to start date and subtract 1 day in SQL, 
  // but we can just do a string compare since ISO dates are lexically sortable, 
  // or use date-fns to get end of month.
  const endOfMonth = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0)
  const endDate = format(endOfMonth, "yyyy-MM-dd")

  // Fetch Output VAT (ภาษีขาย) from Invoices
  // Assuming issue_date is the date to use for tax, fallback to created_at
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, issue_date, created_at, subtotal_satang, vat_amount_satang, clients(name)")
    .eq("org_id", ctx.orgId)
    .gt("vat_amount_satang", 0)
    .gte("issue_date", startDate)
    .lte("issue_date", endDate)
    .order("issue_date", { ascending: true })

  // Fetch Input VAT (ภาษีซื้อ) from Costs
  const { data: costs } = await supabase
    .from("costs")
    .select("id, category, incurred_on, created_at, subtotal_satang, vat_amount_satang, vendor")
    .eq("org_id", ctx.orgId)
    .gt("vat_amount_satang", 0)
    .gte("incurred_on", startDate)
    .lte("incurred_on", endDate)
    .order("incurred_on", { ascending: true })

  const salesVatItems = (invoices || []).map(inv => ({
    id: inv.id,
    date: inv.issue_date || inv.created_at,
    documentNo: inv.number,
    partnerName: inv.clients?.name || "-",
    baseAmount: inv.subtotal_satang || 0,
    vatAmount: inv.vat_amount_satang || 0,
  }))

  const purchaseVatItems = (costs || []).map(cost => ({
    id: cost.id,
    date: cost.incurred_on || cost.created_at,
    documentNo: "-", // Costs might not have a document number field yet
    partnerName: cost.vendor || cost.category,
    baseAmount: cost.subtotal_satang || 0,
    vatAmount: cost.vat_amount_satang || 0,
  }))

  const totalSalesBase = salesVatItems.reduce((acc, item) => acc + item.baseAmount, 0)
  const totalSalesVat = salesVatItems.reduce((acc, item) => acc + item.vatAmount, 0)
  
  const totalPurchaseBase = purchaseVatItems.reduce((acc, item) => acc + item.baseAmount, 0)
  const totalPurchaseVat = purchaseVatItems.reduce((acc, item) => acc + item.vatAmount, 0)

  const netVat = totalSalesVat - totalPurchaseVat

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30) - ${format(new Date(startDate), "MMMM yyyy", { locale: th })}`} 
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ภาษีขายรวม (Output VAT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatTHB(totalSalesVat)}</div>
            <p className="text-xs text-muted-foreground mt-1">จากยอดขายสุทธิ {formatTHB(totalSalesBase)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ภาษีซื้อรวม (Input VAT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatTHB(totalPurchaseVat)}</div>
            <p className="text-xs text-muted-foreground mt-1">จากยอดซื้อสุทธิ {formatTHB(totalPurchaseBase)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ภาษีที่ต้องชำระ (Net VAT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netVat > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatTHB(Math.abs(netVat))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netVat > 0 ? "ต้องชำระเพิ่มให้สรรพากร" : netVat < 0 ? "ขอคืนภาษีได้ / ยกยอดไปเดือนถัดไป" : "พอดีกัน ไม่มียอดต้องชำระ"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการภาษีขาย (รายรับ)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>เลขที่เอกสาร</TableHead>
                <TableHead>ชื่อลูกค้า</TableHead>
                <TableHead className="text-right">มูลค่าสินค้า/บริการ</TableHead>
                <TableHead className="text-right">จำนวนเงินภาษี</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesVatItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">ไม่มีรายการภาษีขายในเดือนนี้</TableCell>
                </TableRow>
              ) : (
                salesVatItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{item.documentNo}</TableCell>
                    <TableCell>{item.partnerName}</TableCell>
                    <TableCell className="text-right">{formatTHB(item.baseAmount)}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">{formatTHB(item.vatAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการภาษีซื้อ (รายจ่าย)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>ผู้จำหน่าย / หมวดหมู่</TableHead>
                <TableHead className="text-right">มูลค่าสินค้า/บริการ</TableHead>
                <TableHead className="text-right">จำนวนเงินภาษี</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseVatItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">ไม่มีรายการภาษีซื้อในเดือนนี้</TableCell>
                </TableRow>
              ) : (
                purchaseVatItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{item.partnerName}</TableCell>
                    <TableCell className="text-right">{formatTHB(item.baseAmount)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatTHB(item.vatAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}
