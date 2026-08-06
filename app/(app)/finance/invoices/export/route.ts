import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { satangToBaht } from "@/lib/money"
import { toCsv } from "@/lib/export/csv"
import { todayISO } from "@/lib/dates"
import { deriveInvoiceStatus } from "@/lib/metrics/invoice-status"
import { Constants } from "@/lib/types/database"

const INVOICE_STATUSES = Constants.public.Enums.invoice_status

/**
 * GET /finance/invoices/export[?status=…]
 * Org-scoped invoice export. Money columns are baht (satang ÷ 100), not satang,
 * so spreadsheets parse them as numbers. `status` filters on the DERIVED status
 * (needs payments), mirroring the Finance page filter and badge.
 */
export async function GET(request: Request) {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const today = todayISO()

  const status = new URL(request.url).searchParams.get("status") ?? ""
  const statusFilter = (
    INVOICE_STATUSES as readonly string[]
  ).includes(status)
    ? status
    : null

  // Derive the effective status (needs payments) so the export's Status column
  // and its ?status= filter match the Finance page — an invoice stored `sent`
  // but past due exports (and filters) as "overdue", just like its badge.
  const [invoicesRes, paymentsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, number, amount_satang, status, due_date, issue_date, clients(name)"
      )
      .eq("org_id", ctx.orgId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("payments")
      .select("invoice_id, amount_satang")
      .eq("org_id", ctx.orgId),
  ])

  const paidByInvoice = new Map<string, number>()
  for (const p of paymentsRes.data ?? []) {
    paidByInvoice.set(
      p.invoice_id,
      (paidByInvoice.get(p.invoice_id) ?? 0) + p.amount_satang
    )
  }

  const invoices = (invoicesRes.data ?? []).map((inv) => ({
    ...inv,
    effectiveStatus: deriveInvoiceStatus(
      inv,
      paidByInvoice.get(inv.id) ?? 0,
      today
    ),
  }))
  const filtered = statusFilter
    ? invoices.filter((inv) => inv.effectiveStatus === statusFilter)
    : invoices

  const headers = [
    "Number",
    "Client",
    "Status",
    "Amount (THB)",
    "Due date",
    "Created",
  ]
  const rows = filtered.map((inv) => [
    inv.number,
    inv.clients?.name ?? "",
    inv.effectiveStatus,
    satangToBaht(inv.amount_satang),
    inv.due_date ?? "",
    inv.issue_date ?? "",
  ])

  const csv = toCsv(headers, rows)
  const filename = `invoices-${todayISO()}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
