"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, PackageCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { receivePOItems } from "../../actions"

type POItem = {
  id: string
  product_id: string
  quantity: number
  received_quantity: number
  products: { name: string; sku: string | null }
}

export function ReceivePODialog({
  poId,
  items,
}: {
  poId: string
  items: POItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Track how many we are receiving right now
  const [receiveAmounts, setReceiveAmounts] = useState<Record<string, number>>(
    items.reduce((acc, item) => ({
      ...acc,
      [item.id]: Math.max(0, item.quantity - (item.received_quantity || 0))
    }), {})
  )

  const handleAmountChange = (id: string, val: string) => {
    const num = parseInt(val, 10)
    setReceiveAmounts(prev => ({
      ...prev,
      [id]: isNaN(num) ? 0 : num
    }))
  }

  const handleReceive = async () => {
    try {
      setIsSubmitting(true)
      
      const itemsToReceive = items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantityToReceive: receiveAmounts[item.id] || 0
      })).filter(item => item.quantityToReceive > 0)

      if (itemsToReceive.length === 0) {
        toast.error("กรุณาระบุจำนวนสินค้าที่ต้องการรับ")
        setIsSubmitting(false)
        return
      }

      const res = await receivePOItems(poId, itemsToReceive)
      
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("รับสินค้าเข้าสต็อกเรียบร้อย")
        setOpen(false)
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด")
    } finally {
      setIsSubmitting(false)
    }
  }

  const fullyReceived = items.every(item => (item.received_quantity || 0) >= item.quantity)
  if (fullyReceived) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full" variant="default" />}>
        <PackageCheck className="mr-2 size-4" />
        รับสินค้าเข้าสต็อก (Receive)
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>รับสินค้าเข้าสต็อก</DialogTitle>
          <DialogDescription>
            ระบุจำนวนสินค้าที่ได้รับจริงในรอบนี้ ระบบจะนำไปบวกเพิ่มในสต็อกอัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {items.map(item => {
            const pending = Math.max(0, item.quantity - (item.received_quantity || 0))
            if (pending === 0) return null
            
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.products?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    สั่งซื้อ: {item.quantity} | รับแล้ว: {item.received_quantity || 0} | ค้างรับ: {pending}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-[120px]">
                  <Input 
                    type="number" 
                    min={0}
                    max={pending}
                    value={receiveAmounts[item.id]?.toString() || "0"}
                    onChange={(e) => handleAmountChange(item.id, e.target.value)}
                    className="text-right"
                  />
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            ยกเลิก
          </Button>
          <Button onClick={handleReceive} disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการรับสินค้า"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
