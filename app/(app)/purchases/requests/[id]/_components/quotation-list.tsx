"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, FileText, CheckCircle, Save, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addQuotation, updateQuotation, selectQuotationForPR } from "../../actions"

export function QuotationList({ prId, prStatus, selectedQuotationId, initialQuotations, suppliers }: { prId: string, prStatus: string, selectedQuotationId?: string, initialQuotations: any[], suppliers: any[] }) {
  const [quotations, setQuotations] = useState(initialQuotations)
  const [isAdding, setIsAdding] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [selectionReason, setSelectionReason] = useState("")
  
  // Form state
  const [supplierId, setSupplierId] = useState("")
  const [quotationNumber, setQuotationNumber] = useState("")
  const [quotationDate, setQuotationDate] = useState("")
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit, setUnit] = useState("")
  const [leadTime, setLeadTime] = useState("")
  const [paymentTerm, setPaymentTerm] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [remark, setRemark] = useState("")
  const [attachmentUrl, setAttachmentUrl] = useState("")
  const [status, setStatus] = useState<"draft" | "received">("draft")

  const [loading, setLoading] = useState(false)

  // Recommendation logic
  // Find minimum price among received/selected quotations
  const validQuotations = quotations.filter(q => q.status === 'received' || q.status === 'selected' || q.status === 'rejected')
  const minPrice = validQuotations.length > 0 ? Math.min(...validQuotations.map(q => Number(q.price))) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId || !price || !quantity) {
      toast.error("กรุณาระบุ Supplier, ราคา, และจำนวน")
      return
    }

    setLoading(true)
    const res = await addQuotation({
      pr_id: prId,
      supplier_id: supplierId,
      quotation_number: quotationNumber,
      quotation_date: quotationDate,
      price: Number(price),
      quantity: Number(quantity),
      unit,
      lead_time: leadTime,
      payment_term: paymentTerm,
      valid_until: validUntil || undefined,
      remark,
      attachment_url: attachmentUrl,
      status
    })
    setLoading(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("บันทึก Quotation สำเร็จ")
      setIsAdding(false)
      window.location.reload()
    }
  }

  async function handleMarkReceived(id: string) {
    const res = await updateQuotation(id, { status: "received", pr_id: prId })
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("อัปเดตสถานะเป็น Received แล้ว")
      window.location.reload()
    }
  }

  async function handleSelectQuotation(id: string) {
    if (!selectionReason) {
      toast.error("กรุณาระบุเหตุผลในการเลือก Supplier นี้")
      return
    }
    setLoading(true)
    const res = await selectQuotationForPR({
      pr_id: prId,
      quotation_id: id,
      reason: selectionReason
    })
    setLoading(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("เลือก Quotation เพื่อขออนุมัติเรียบร้อยแล้ว")
      setSelectingId(null)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      {quotations.length === 0 && !isAdding && (
        <div className="text-center p-8 border border-dashed border-white/20 rounded-lg text-white/50">
          ยังไม่มีการเสนอราคาจาก Supplier
        </div>
      )}

      {quotations.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {quotations.map(q => {
            const isLowestPrice = minPrice !== null && Number(q.price) === minPrice && (q.status === 'received' || q.status === 'selected' || q.status === 'rejected');
            const isSelected = selectedQuotationId === q.id || q.status === 'selected';
            const isSelectable = q.status === 'received' && (prStatus === 'in_procurement' || prStatus === 'submitted');

            return (
              <div key={q.id} className={`bg-black/40 border ${isSelected ? 'border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'border-white/10'} rounded-lg p-5 space-y-3 relative`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-blue-300 flex items-center gap-2">
                      {q.suppliers?.name}
                      {isSelected && <CheckCircle className="w-4 h-4 text-green-400" />}
                    </h4>
                    {isLowestPrice && !isSelected && (
                      <span className="text-xs text-yellow-400 mt-1 inline-block bg-yellow-400/10 px-2 py-0.5 rounded">💰 ราคาต่ำสุด</span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    q.status === 'draft' ? 'bg-zinc-500/20 text-zinc-300' : 
                    q.status === 'selected' ? 'bg-green-500/20 text-green-300' :
                    q.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {q.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-white/80">
                  <div><span className="text-white/50 text-xs">Quotation No:</span> {q.quotation_number || "-"}</div>
                  <div><span className="text-white/50 text-xs">Date:</span> {q.quotation_date || "-"}</div>
                  <div><span className="text-white/50 text-xs">Price/Total:</span> <span className={isLowestPrice ? "text-yellow-400 font-medium" : ""}>฿{Number(q.price).toFixed(2)}</span></div>
                  <div><span className="text-white/50 text-xs">Quantity:</span> {q.quantity} {q.unit}</div>
                  <div><span className="text-white/50 text-xs">Lead Time:</span> {q.lead_time || "-"}</div>
                  <div><span className="text-white/50 text-xs">Payment Term:</span> {q.payment_term || "-"}</div>
                  <div className="col-span-2"><span className="text-white/50 text-xs">Valid Until:</span> {q.valid_until || "-"}</div>
                  {q.remark && <div className="col-span-2"><span className="text-white/50 text-xs">Remark:</span> {q.remark}</div>}
                </div>
                
                {q.attachment_url && (
                  <a href={q.attachment_url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 mt-2">
                    <FileText className="w-4 h-4" /> View Quotation
                  </a>
                )}
                
                <div className="pt-3 border-t border-white/10 mt-3 flex justify-end gap-2">
                  {q.status === 'draft' && (
                    <Button variant="secondary" size="sm" onClick={() => handleMarkReceived(q.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Mark as Received
                    </Button>
                  )}
                  {isSelectable && selectingId !== q.id && (
                    <Button variant="default" size="sm" onClick={() => setSelectingId(q.id)}>
                      <Check className="w-4 h-4 mr-2" /> Select for Approval
                    </Button>
                  )}
                </div>

                {selectingId === q.id && (
                  <div className="mt-3 p-3 bg-white/5 rounded border border-blue-500/30">
                    <label className="block text-xs text-blue-300 mb-1">เหตุผลในการเลือก (Reason for Selection) *</label>
                    <input 
                      type="text" 
                      value={selectionReason}
                      onChange={e => setSelectionReason(e.target.value)}
                      placeholder={isLowestPrice ? "เช่น ราคาต่ำที่สุดตามนโยบาย" : "เช่น Lead Time เร็วกว่า, สเปคตรงกว่า"}
                      className="w-full bg-black/40 border border-white/20 rounded px-2 py-1.5 text-sm text-white mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectingId(null)}>Cancel</Button>
                      <Button variant="default" size="sm" disabled={loading} onClick={() => handleSelectQuotation(q.id)}>Confirm Selection</Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recommend summary if we have received quotations */}
      {validQuotations.length > 0 && prStatus !== 'pending_approval' && prStatus !== 'approved' && (
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm">
          <strong className="block text-blue-300 mb-2">💡 Comparison Recommendation</strong>
          <ul className="space-y-1 text-white/80 list-disc list-inside">
            {quotations.map(q => {
              if (q.status !== 'received' && q.status !== 'selected' && q.status !== 'rejected') return null;
              const isLowestPrice = minPrice !== null && Number(q.price) === minPrice;
              let traits = [];
              if (isLowestPrice) traits.push("ราคาต่ำที่สุด");
              if (q.lead_time && q.lead_time.toLowerCase().includes('วัน') && parseInt(q.lead_time) <= 7) traits.push("จัดส่งไว");
              else if (q.lead_time && q.lead_time.toLowerCase().includes('days') && parseInt(q.lead_time) <= 7) traits.push("จัดส่งไว");
              
              if (traits.length === 0) return <li key={`rec-${q.id}`}>{q.suppliers?.name}: เสนอราคาที่ ฿{Number(q.price).toFixed(2)}</li>
              return <li key={`rec-${q.id}`}>{q.suppliers?.name}: <span className="text-blue-300 font-medium">{traits.join(" และ ")}</span> (฿{Number(q.price).toFixed(2)})</li>
            })}
          </ul>
          <p className="text-white/50 text-xs mt-3">* ข้อมูลนี้เป็นเพียงคำแนะนำเบื้องต้น โปรดพิจารณา Specification และเงื่อนไขอื่นๆ ประกอบการเลือก Supplier</p>
        </div>
      )}

      {prStatus === 'pending_approval' && (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-sm text-center">
          <strong className="block text-green-400 mb-1">✅ Supplier Selected</strong>
          <p className="text-white/80">PR นี้ถูกเลือก Supplier และส่งเข้าระบบรออนุมัติ (Pending Approval) แล้ว</p>
        </div>
      )}

      {!isAdding && (prStatus === 'in_procurement' || prStatus === 'submitted') ? (
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Quotation
        </Button>
      ) : isAdding ? (
        <form onSubmit={handleSubmit} className="bg-white/5 p-5 rounded-lg border border-white/10 space-y-4">
          <h4 className="font-semibold text-white mb-2">New Quotation</h4>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="space-y-1">
              <label className="text-white/70">Supplier *</label>
              <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white">
                <option value="">-- เลือก Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Quotation No.</label>
              <input type="text" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Date</label>
              <input type="date" value={quotationDate} onChange={e => setQuotationDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Price *</label>
              <input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Quantity *</label>
              <input type="number" required min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Unit</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Lead Time</label>
              <input type="text" placeholder="e.g. 7 Days" value={leadTime} onChange={e => setLeadTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Payment Term</label>
              <input type="text" placeholder="e.g. Net 30, Cash" value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-white/70">Attachment URL</label>
              <input type="url" value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-white/70">Status</label>
              <select value={status} onChange={(e: any) => setStatus(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white">
                <option value="draft">Draft</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-white/70">Remark</label>
              <input type="text" value={remark} onChange={e => setRemark(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded h-9 px-2 text-white" />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" /> {loading ? "Saving..." : "Save Quotation"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
