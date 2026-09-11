"use client"
import { useState } from "react"
import { QrCode, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { processInventoryTransaction } from "../actions"

export function TransactionDialog({
  productId,
  locationId,
  productName,
  type,
  projects
}: {
  productId: string
  locationId: string
  productName: string
  type: "receive" | "issue"
  projects?: { id: string, name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [qr, setQr] = useState("")
  const [ref, setRef] = useState("")
  const [loading, setLoading] = useState(false)
  const [idemKey, setIdemKey] = useState("")

  const isReceive = type === "receive"
  const title = isReceive ? "รับสินค้าเข้าคลัง (Receive)" : "เบิกสินค้าออก (Issue)"
  const Icon = isReceive ? ArrowDownToLine : ArrowUpFromLine

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await processInventoryTransaction({
      product_id: productId,
      location_id: locationId,
      transaction_type: type,
      quantity: isReceive ? qty : -qty,
      unit_cost: isReceive ? unitCost : undefined,
      reference_no: ref || null,
      batch_qr_code: qr || null,
      idempotency_key: idemKey,
    })
    setLoading(false)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success(isReceive ? "รับสินค้าเรียบร้อย" : "เบิกสินค้าเรียบร้อย")
      setOpen(false)
    }
  }

  return (
    <>
      <Button 
        variant={isReceive ? "outline" : "default"} 
        size="sm" 
        className="h-8 text-xs"
        onClick={() => {
          setOpen(true)
          setIdemKey(crypto.randomUUID())
        }}
      >
        <Icon className="size-3 mr-1" /> {isReceive ? "รับ" : "จ่าย"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="size-5" /> {title}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>สินค้า</Label>
              <div className="p-2 bg-muted rounded-md text-sm font-medium">{productName}</div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>สแกน QR Code / Barcode</span>
                <span className="text-xs text-blue-600 flex items-center gap-1"><QrCode className="size-3"/> พร้อมสแกน</span>
              </Label>
              <Input 
                autoFocus
                placeholder="คลิกที่นี่และใช้เครื่องสแกน..." 
                value={qr} 
                onChange={e => setQr(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground">จำลอง: ลองพิมพ์อักษรจำลองเช่น "LOT-001" หรือยิงบาร์โค้ดจริง</p>
            </div>
            
            <div className={`grid gap-4 ${isReceive ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="space-y-2">
                <Label>จำนวน (Quantity)</Label>
                <Input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} required />
              </div>
              {isReceive && (
                <div className="space-y-2">
                  <Label>ต้นทุนต่อหน่วย</Label>
                  <Input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>{isReceive ? "อ้างอิง (เช่น PO No.)" : "อ้างอิงโปรเจกต์"}</Label>
                {isReceive ? (
                  <Input placeholder="PO-..." value={ref} onChange={e => setRef(e.target.value)} />
                ) : (
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={ref}
                    onChange={e => setRef(e.target.value)}
                  >
                    <option value="">-- ไม่ระบุ / เบิกทั่วไป --</option>
                    {projects?.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={loading} className={isReceive ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                {isReceive ? "บันทึกรับเข้า" : "บันทึกเบิกออก"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
