"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generatePOFromPR } from "../../actions"

export function GeneratePOButton({ prId }: { prId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleGeneratePO() {
    setLoading(true)
    const res = await generatePOFromPR(prId)
    setLoading(false)

    if (res.error) {
      toast.error(res.error)
    } else if (res.poId) {
      toast.success("สร้างใบสั่งซื้อ (PO) สำเร็จ")
      router.push(`/purchases/${res.poId}`)
    }
  }

  return (
    <Button 
      variant="default" 
      onClick={handleGeneratePO} 
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4 mr-2" />
      )}
      {loading ? "กำลังสร้าง PO..." : "Generate Purchase Order"}
    </Button>
  )
}
