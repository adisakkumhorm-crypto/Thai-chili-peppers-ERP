import { createClient } from "@/lib/supabase/server"
import { Database } from "@/lib/types/database"

type JournalEntrySource = Database["public"]["Enums"]["journal_entry_source"]

async function getAccountByCode(orgId: string, code: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("code", code)
    .single()
  return data?.id
}

async function isJournalExists(orgId: string, referenceId: string, source: JournalEntrySource) {
  const supabase = await createClient()
  const { count } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("reference_id", referenceId)
    .eq("source", source)
  
  return (count || 0) > 0
}

export async function autoJournalForInvoice(orgId: string, invoiceId: string, _legacyAmount?: number, invoiceNumber?: string) {
  if (await isJournalExists(orgId, invoiceId, 'invoice')) return;
  const supabase = await createClient()
  
  const { data: inv } = await supabase
    .from("invoices")
    .select("number, amount_satang, subtotal_satang, vat_amount_satang, wht_amount_satang")
    .eq("id", invoiceId)
    .single()
    
  if (!inv) return;
  
  const num = invoiceNumber || inv.number;
  const subtotal = inv.subtotal_satang || inv.amount_satang;
  const vat = inv.vat_amount_satang || 0;
  const arAmount = inv.amount_satang;
  const wht = inv.wht_amount_satang || 0;
  
  const arAccountId = await getAccountByCode(orgId, '1200')
  const revAccountId = await getAccountByCode(orgId, '4100')
  
  if (!arAccountId || !revAccountId) return;

  const outVatAccountId = vat > 0 ? await getAccountByCode(orgId, '2150') : null
  const whtRecAccountId = wht > 0 ? await getAccountByCode(orgId, '1154') : null
  
  const lines: any[] = [
    { account_id: arAccountId, debit: arAmount, credit: 0 },
    { account_id: revAccountId, debit: 0, credit: subtotal }
  ]
  
  if (vat > 0 && outVatAccountId) lines.push({ account_id: outVatAccountId, debit: 0, credit: vat })
  if (wht > 0 && whtRecAccountId) lines.push({ account_id: whtRecAccountId, debit: wht, credit: 0 })

  const { error } = await supabase.rpc('create_automated_journal_entry', {
    p_org_id: orgId, p_source: 'invoice', p_reference_id: invoiceId, p_description: `ตั้งหนี้ลูกหนี้การค้า ใบแจ้งหนี้ ${num}`, p_lines: lines
  })
}

export async function autoJournalForPayment(orgId: string, paymentId: string, invoiceId: string, amountSatang: number, invoiceNumber: string, method: string) {
  if (await isJournalExists(orgId, paymentId, 'payment')) return;
  const supabase = await createClient()
  
  const cashCode = method === 'cash' ? '1110' : '1120'
  const cashAccountId = await getAccountByCode(orgId, cashCode)
  const arAccountId = await getAccountByCode(orgId, '1200')
  
  if (!cashAccountId || !arAccountId) return;

  const lines = [
    { account_id: cashAccountId, debit: amountSatang, credit: 0 },
    { account_id: arAccountId, debit: 0, credit: amountSatang }
  ]

  const { error } = await supabase.rpc('create_automated_journal_entry', {
    p_org_id: orgId, p_source: 'payment', p_reference_id: paymentId, p_description: `รับชำระเงินตามใบแจ้งหนี้ ${invoiceNumber}`, p_lines: lines
  })
}

export async function autoJournalForCost(orgId: string, costId: string, _legacyAmount?: number, category?: string, vendor?: string | null) {
  if (await isJournalExists(orgId, costId, 'manual')) return;
  const supabase = await createClient()
  
  const { data: cost } = await supabase
    .from("costs")
    .select("category, vendor, amount_satang, subtotal_satang, vat_amount_satang, wht_amount_satang")
    .eq("id", costId)
    .single()
    
  if (!cost) return;
  
  const cat = category || cost.category;
  const ven = vendor || cost.vendor;
  const subtotal = cost.subtotal_satang || cost.amount_satang;
  const vat = cost.vat_amount_satang || 0;
  const wht = cost.wht_amount_satang || 0;
  const bankAmount = cost.amount_satang;
  
  let expenseCode = '5900'
  if (cat === 'software' || cat === 'infra') expenseCode = '5400'
  else if (cat === 'contractor') expenseCode = '5500'
  else if (cat === 'marketing') expenseCode = '5300'
  else if (cat === 'salary') expenseCode = '5200'

  const expenseAccountId = await getAccountByCode(orgId, expenseCode)
  const bankAccountId = await getAccountByCode(orgId, '1120')
  
  if (!expenseAccountId || !bankAccountId) return;

  const inVatAccountId = vat > 0 ? await getAccountByCode(orgId, '1155') : null
  const whtPayAccountId = wht > 0 ? await getAccountByCode(orgId, '2130') : null
  
  const lines: any[] = [
    { account_id: expenseAccountId, debit: subtotal, credit: 0 },
    { account_id: bankAccountId, debit: 0, credit: bankAmount }
  ]
  
  if (vat > 0 && inVatAccountId) lines.push({ account_id: inVatAccountId, debit: vat, credit: 0 })
  if (wht > 0 && whtPayAccountId) lines.push({ account_id: whtPayAccountId, debit: 0, credit: wht })

  const desc = ven ? `บันทึกค่าใช้จ่าย ${cat} - ${ven}` : `บันทึกค่าใช้จ่าย ${cat}`

  const { error } = await supabase.rpc('create_automated_journal_entry', {
    p_org_id: orgId, p_source: 'manual', p_reference_id: costId, p_description: desc, p_lines: lines
  })
}
