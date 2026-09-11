"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createPurchaseRequest, getProductInventoryAction } from "../actions"

export function PRForm({ projects, products }: { projects: any[], products: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checkingStock, setCheckingStock] = useState(false)
  const [inventory, setInventory] = useState<any>(null)
  
  const [reason, setReason] = useState("")
  const [projectId, setProjectId] = useState("")
  const [requiredDate, setRequiredDate] = useState("")
  const [estimatedBudget, setEstimatedBudget] = useState("")
  const [attachmentUrl, setAttachmentUrl] = useState("")
  
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState("")
  const [specification, setSpecification] = useState("")

  useEffect(() => {
    if (productId) {
      setCheckingStock(true)
      getProductInventoryAction(productId).then(data => {
        setInventory(data)
        setCheckingStock(false)
      }).catch(() => {
        setCheckingStock(false)
      })
    } else {
      setInventory(null)
    }
  }, [productId])

  const required = quantity > 0 ? quantity : 0
  const totalAvailable = inventory?.available || 0
  const suggested = Math.min(required, totalAvailable)
  const shortage = Math.max(required - totalAvailable, 0)

  // Step 4: Recommendation Logic
  let recommendationNode = null;
  if (inventory && required > 0) {
    const availableLocs = inventory.locations?.filter((l: any) => l.available > 0) || [];
    const locNames = availableLocs.map((l: any) => l.locationName).join(', ');

    if (shortage === 0) {
      recommendationNode = (
        <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
          <strong className="block mb-1">💡 Recommendation:</strong>
          มี Stock เพียงพอ {required} หน่วย<br/>
          ไม่จำเป็นต้องจัดซื้อเพิ่ม
          {availableLocs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-green-500/20 text-sm">
              📍 พบ Stock จาก: {locNames}<br/>
              สามารถพิจารณาโอนย้ายก่อนจัดซื้อ
            </div>
          )}
        </div>
      );
    } else if (suggested > 0 && shortage > 0) {
      recommendationNode = (
        <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          <strong className="block mb-1">💡 Recommendation:</strong>
          พบ Stock พร้อมใช้ {suggested} หน่วย<br/>
          ต้องการ {required} หน่วย<br/>
          แนะนำใช้ Stock {suggested} หน่วย และจัดซื้อเพิ่ม {shortage} หน่วย
          {availableLocs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-yellow-500/20 text-sm">
              📍 พบ Stock {suggested} หน่วยจาก: {locNames}<br/>
              สามารถพิจารณาโอนย้ายก่อนจัดซื้อ
            </div>
          )}
        </div>
      );
    } else {
      recommendationNode = (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <strong className="block mb-1">💡 Recommendation:</strong>
          ไม่พบ Stock ที่พร้อมใช้งาน<br/>
          ต้องจัดซื้อ {shortage} หน่วย
        </div>
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || quantity <= 0) {
      toast.error("กรุณาเลือกสินค้าและระบุจำนวนที่ถูกต้อง")
      return
    }

    setLoading(true)
    const res = await createPurchaseRequest({
      project_id: projectId || undefined,
      reason,
      required_date: requiredDate || undefined,
      estimated_budget: estimatedBudget ? Number(estimatedBudget) : undefined,
      attachment_url: attachmentUrl || undefined,
      items: [
        {
          product_id: productId,
          quantity: Number(quantity),
          unit: unit || undefined,
          specification: specification || undefined
        }
      ]
    })

    setLoading(false)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("ส่งคำขอจัดซื้อสำเร็จ! ระบบประเมิน Stock เรียบร้อยแล้ว (ไม่ทำการจอง)")
      router.push("/my-requests")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-white/70 font-medium">Project (ถ้ามี)</label>
          <select 
            value={projectId} 
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
          >
            <option value="">-- ไม่ระบุ Project --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-white/70 font-medium">Required Date (วันที่ต้องการ)</label>
          <input 
            type="date"
            value={requiredDate}
            onChange={(e) => setRequiredDate(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-white/70 font-medium">Estimated Budget (งบประมาณประเมิน)</label>
          <input 
            type="number"
            value={estimatedBudget}
            onChange={(e) => setEstimatedBudget(e.target.value)}
            placeholder="0.00"
            className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-white/70 font-medium">Attachment URL (แนบไฟล์/ลิงก์)</label>
          <input 
            type="url"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-white/70 font-medium">Reason / Description (เหตุผลการขอซื้อ) *</label>
          <input 
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผลความจำเป็น"
            className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
          />
        </div>
      </div>

      <div className="p-4 border border-white/10 rounded-lg bg-white/5 space-y-4">
        <h3 className="font-semibold text-white">Item Detail (รายละเอียดวัสดุ/สินค้า)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-white/70 font-medium">Product / Material *</label>
            <select 
              required
              value={productId} 
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-white/70 font-medium">Quantity (จำนวน) *</label>
            <input 
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-white/70 font-medium">Unit (หน่วยนับ)</label>
            <input 
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="เช่น ชิ้น, กล่อง, เมตร"
              className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-white/70 font-medium">Specification (สเปค)</label>
            <input 
              type="text"
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              placeholder="รายละเอียดสเปคสินค้า"
              className="w-full bg-black/40 border border-white/10 rounded-lg h-10 px-3 text-white"
            />
          </div>
        </div>
        
        {productId && (
          <div className="pt-4 mt-4 border-t border-white/10 space-y-4">
            <h4 className="font-semibold text-blue-300 flex items-center gap-2">
              📊 Inventory Check (ระบบประเมิน Stock)
            </h4>
            {checkingStock ? (
              <p className="text-white/60 text-sm">กำลังตรวจสอบ Stock...</p>
            ) : inventory ? (
              <div className="text-sm space-y-4 bg-black/20 p-4 rounded-lg border border-white/5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-white/80">
                  <div>
                    <span className="block text-white/50 text-xs">Total On Hand</span>
                    <span className="font-medium text-lg">{inventory.onHand}</span>
                  </div>
                  <div>
                    <span className="block text-white/50 text-xs">Total Allocated</span>
                    <span className="font-medium text-lg">{inventory.allocated}</span>
                  </div>
                  <div>
                    <span className="block text-white/50 text-xs">Total Available</span>
                    <span className="font-medium text-lg text-green-400">{totalAvailable}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <strong className="text-white/90 block mb-2">แยกตาม Location / Warehouse:</strong>
                  {inventory.locations && inventory.locations.length > 0 ? (
                    <ul className="space-y-2">
                      {inventory.locations.map((loc: any, idx: number) => (
                        <li key={idx} className="flex flex-col text-white/80 bg-white/5 p-3 rounded-md border border-white/5">
                          <span className="font-semibold text-white">{loc.locationName}</span>
                          <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                            <span>On Hand: {loc.onHand}</span>
                            <span>Allocated: {loc.allocated}</span>
                            <span className="text-green-300 font-medium">Available: {loc.available}</span>
                          </div>
                          <span className="text-yellow-400/80 text-xs mt-2 bg-yellow-400/10 inline-block px-2 py-1 rounded w-fit">
                            * Stock ที่อาจนำมาใช้ได้ (รอพิจารณาโอนย้าย)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/50 text-xs mt-1">ไม่มีข้อมูลในคลังสินค้า</p>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                    <span className="block text-blue-300 text-xs">Suggested Stock Usage</span>
                    <span className="font-semibold text-lg text-blue-400">{suggested}</span>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                    <span className="block text-orange-300 text-xs">Purchase Shortage</span>
                    <span className="font-semibold text-lg text-orange-400">{shortage}</span>
                  </div>
                </div>

                <p className="text-blue-300/80 text-xs mt-2">
                  ** ระบบแสดงข้อมูลเพื่อประกอบการตัดสินใจเท่านั้น ไม่มีการจอง (Reserve) หรือโอนย้าย (Transfer) อัตโนมัติในขั้นตอนนี้
                </p>
                {recommendationNode}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={() => router.push("/my-requests")}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Purchase Request"}
        </Button>
      </div>
    </form>
  )
}
