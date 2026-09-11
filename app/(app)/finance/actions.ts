"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"
import { bahtToSatang, formatTHBWhole } from "@/lib/money"
import { writeAudit } from "@/lib/audit"
import {
  autoJournalForInvoice,
  autoJournalForPayment,
  autoJournalForCost,
} from "@/lib/accounting/auto-journal"

const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"] as const
const RECURRING_INTERVALS = ["weekly", "monthly", "quarterly", "yearly"] as const
const COST_CATEGORIES = ["software", "contractor", "infra", "marketing", "salary", "other"] as const
const PAYMENT_METHODS = ["transfer", "cash", "card", "promptpay", "cheque", "other"] as const

const optionalString = z.string().trim().optional().transform((v) => (v ? v : undefined))
const optionalId = z.string().optional().transform((v) => (v ? v : null))
const optionalDate = z.string().optional().transform((v) => (v ? v : null))

// --- Invoices ---
const CreateInvoice = z.object({
  client_id: z.string().min(1, "Client is required"),
  project_id: optionalId,
  number: z.string().trim().min(1, "Invoice number is required"),
  status: z.enum(INVOICE_STATUSES).default("draft"),
  issue_date: optionalDate,
  due_date: optionalDate,
  subtotalBaht: z.coerce.number().min(0, "Amount must be 0 or more"),
  vat_rate_id: optionalId,
  wht_rate_id: optionalId,
  vat_amountBaht: z.coerce.number().default(0),
  wht_amountBaht: z.coerce.number().default(0),
  is_recurring: z.coerce.boolean().default(false),
  recurring_interval: z.enum(RECURRING_INTERVALS).nullish(),
  notes: optionalString,
})

export async function createInvoice(input: z.input<typeof CreateInvoice>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = CreateInvoice.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }
  const d = parsed.data

  const supabase = await createSupabaseClient()
  const amount_satang = bahtToSatang(d.subtotalBaht) + bahtToSatang(d.vat_amountBaht) - bahtToSatang(d.wht_amountBaht)
  
  const p_id = crypto.randomUUID()
  const { error } = await supabase.rpc("rpc_create_invoice", {
    p_id,
    p_org_id: ctx.orgId,
    p_client_id: d.client_id,
    p_project_id: d.project_id ?? undefined,
    p_number: d.number,
    p_status: d.status,
    p_issue_date: d.issue_date ?? undefined,
    p_due_date: d.due_date ?? undefined,
    p_subtotal_satang: bahtToSatang(d.subtotalBaht),
    p_vat_amount_satang: bahtToSatang(d.vat_amountBaht),
    p_wht_amount_satang: bahtToSatang(d.wht_amountBaht),
    p_vat_rate_id: d.vat_rate_id ?? undefined,
    p_wht_rate_id: d.wht_rate_id ?? undefined,
    p_amount_satang: amount_satang,
    p_is_recurring: d.is_recurring,
    p_recurring_interval: d.is_recurring ? (d.recurring_interval ?? undefined) : undefined,
    p_notes: d.notes ?? undefined,
  })

  if (error) {
    if (error.code === "23505") return { error: `Invoice number "${d.number}" already exists.` }
    return { error: error.message }
  }

  await writeAudit(ctx, {
    entity: "invoice",
    entityId: p_id,
    action: "created",
    summary: `Created invoice ${d.number} for ${formatTHBWhole(amount_satang)}`,
  })

  revalidatePath("/finance")
  redirect(`/finance/invoices/${p_id}`)
}

const UpdateInvoice = z.object({
  id: z.string().min(1),
  client_id: z.string().min(1, "Client is required"),
  project_id: optionalId,
  number: z.string().trim().min(1, "Invoice number is required"),
  status: z.enum(INVOICE_STATUSES),
  issue_date: optionalDate,
  due_date: optionalDate,
  subtotalBaht: z.coerce.number().min(0, "Amount must be 0 or more"),
  vat_rate_id: optionalId,
  wht_rate_id: optionalId,
  vat_amountBaht: z.coerce.number().default(0),
  wht_amountBaht: z.coerce.number().default(0),
  is_recurring: z.coerce.boolean(),
  recurring_interval: z.enum(RECURRING_INTERVALS).nullish(),
  notes: optionalString,
})

export async function updateInvoice(input: z.input<typeof UpdateInvoice>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = UpdateInvoice.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }
  const d = parsed.data

  const supabase = await createSupabaseClient()
  const amount_satang = bahtToSatang(d.subtotalBaht) + bahtToSatang(d.vat_amountBaht) - bahtToSatang(d.wht_amountBaht)
  
  const { error } = await supabase
    .from("invoices")
    .update({
      client_id: d.client_id,
      project_id: d.project_id,
      number: d.number,
      status: d.status,
      issue_date: d.issue_date ?? undefined,
      due_date: d.due_date,
      subtotal_satang: bahtToSatang(d.subtotalBaht),
      vat_amount_satang: bahtToSatang(d.vat_amountBaht),
      wht_amount_satang: bahtToSatang(d.wht_amountBaht),
      vat_rate_id: d.vat_rate_id,
      wht_rate_id: d.wht_rate_id,
      amount_satang,
      is_recurring: d.is_recurring,
      recurring_interval: d.is_recurring ? (d.recurring_interval ?? null) : null,
      notes: d.notes,
    })
    .eq("id", d.id)
    .eq("org_id", ctx.orgId)

  if (error) {
    if (error.code === "23505") return { error: `Invoice number "${d.number}" already exists.` }
    if (error.code === "P0002" || error.message.includes("Invoice นี้ถูกบันทึกบัญชีแล้ว")) return { error: "POSTED_INVOICE_IMMUTABLE: Invoice นี้ถูกบันทึกบัญชีแล้ว ไม่สามารถแก้ไขข้อมูลทางการเงินได้ กรุณายกเลิกเอกสารและสร้าง Invoice ใหม่" }
    return { error: error.message }
  }

  await writeAudit(ctx, {
    entity: "invoice",
    entityId: d.id,
    action: "updated",
    summary: `Updated invoice ${d.number}`,
  })

  revalidatePath("/finance")
  revalidatePath(`/finance/invoices/${d.id}`)
  return {}
}

// --- Payments ---
const RecordPayment = z.object({
  invoice_id: z.string().min(1),
  amountBaht: z.coerce.number().positive("Amount must be greater than 0"),
  paid_at: optionalDate,
  method: z.enum(PAYMENT_METHODS).default("transfer"),
  notes: optionalString,
})

export async function recordPayment(input: z.input<typeof RecordPayment>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = RecordPayment.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }
  const d = parsed.data

  const supabase = await createSupabaseClient()

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, number, amount_satang, status")
    .eq("id", d.invoice_id)
    .eq("org_id", ctx.orgId)
    .single()

  if (invErr || !invoice) return { error: "Invoice not found" }

  const amount_satang = bahtToSatang(d.amountBaht)
  const p_id = crypto.randomUUID()
  const { error: payErr } = await supabase.rpc("rpc_record_payment", {
    p_id,
    p_org_id: ctx.orgId,
    p_invoice_id: d.invoice_id,
    p_amount_satang: amount_satang,
    p_paid_at: d.paid_at ?? undefined,
    p_method: d.method,
    p_notes: d.notes ?? undefined,
  })

  if (payErr) return { error: payErr.message }

  await writeAudit(ctx, {
    entity: "payment",
    entityId: d.invoice_id,
    action: "payment_recorded",
    summary: `Recorded ${formatTHBWhole(amount_satang)} payment on invoice ${invoice.number}`,
    meta: { invoiceId: d.invoice_id, method: d.method },
  })

  // Auto journal is now handled within rpc_record_payment

  revalidatePath("/finance")
  revalidatePath(`/finance/invoices/${d.invoice_id}`)
  return {}
}

// --- Costs ---
const CreateCost = z.object({
  category: z.enum(COST_CATEGORIES).default("other"),
  subtotalBaht: z.coerce.number().min(0, "Amount must be 0 or more"),
  vat_rate_id: optionalId,
  wht_rate_id: optionalId,
  vat_amountBaht: z.coerce.number().default(0),
  wht_amountBaht: z.coerce.number().default(0),
  incurred_on: optionalDate,
  vendor: optionalString,
  project_id: optionalId,
  notes: optionalString,
  po_id: optionalId,
  supplier_id: optionalId,
})

export async function createCost(input: z.input<typeof CreateCost>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = CreateCost.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }
  const d = parsed.data

  const supabase = await createSupabaseClient()
  const amount_satang = bahtToSatang(d.subtotalBaht) + bahtToSatang(d.vat_amountBaht) - bahtToSatang(d.wht_amountBaht)

  const p_id = crypto.randomUUID()
  const { error } = await supabase.rpc("rpc_create_cost", {
    p_id,
    p_org_id: ctx.orgId,
    p_category: d.category,
    p_subtotal_satang: bahtToSatang(d.subtotalBaht),
    p_vat_amount_satang: bahtToSatang(d.vat_amountBaht),
    p_wht_amount_satang: bahtToSatang(d.wht_amountBaht),
    p_vat_rate_id: d.vat_rate_id ?? undefined,
    p_wht_rate_id: d.wht_rate_id ?? undefined,
    p_amount_satang: amount_satang,
    p_incurred_on: d.incurred_on ?? undefined,
    p_vendor: d.vendor ?? undefined,
    p_project_id: d.project_id ?? undefined,
    p_notes: d.notes ?? undefined,
    p_po_id: d.po_id ?? undefined,
    p_supplier_id: d.supplier_id ?? undefined,
  })

  if (error) return { error: error.message }

  await writeAudit(ctx, {
    entity: "cost",
    entityId: p_id,
    action: "created",
    summary: `Recorded ${formatTHBWhole(amount_satang)} ${d.category} cost`,
    meta: { category: d.category, vendor: d.vendor ?? null },
  })

  // Auto journal is now handled within rpc_create_cost

  revalidatePath("/finance")
  redirect("/finance")
}

const DeleteCost = z.object({ id: z.string().min(1) })

export async function deleteCost(input: z.input<typeof DeleteCost>): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "Only owners and admins can delete costs." }
  }
  const parsed = DeleteCost.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("costs")
    .delete()
    .eq("id", parsed.data.id)
    .eq("org_id", ctx.orgId)

  if (error) {
    if (error.code === "P0002" || error.message.includes("POSTED_COST_IMMUTABLE")) {
      return { error: "POSTED_COST_IMMUTABLE: Cost นี้ถูกบันทึกบัญชีแล้ว ไม่สามารถลบได้ กรุณาใช้กระบวนการ Cancel/Reverse ที่รองรับ" }
    }
    return { error: error.message }
  }

  revalidatePath("/finance")
  return {}
}
