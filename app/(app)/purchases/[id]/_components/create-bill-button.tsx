"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createCostFromPO } from "../../actions"

export function CreateBillButton({ poId }: { poId: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateBill = async () => {
    try {
      setIsSubmitting(true)
      const res = await createCostFromPO(poId)
      
      if (res?.error) {
        toast.error(res.error)
      } else if (res?.costId) {
        toast.success("สร้างบิลค่าใช้จ่ายสำเร็จ!")
        // Optional: redirect to the new cost page or just refresh
        router.push("/finance")
      }
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleCreateBill}
      disabled={isSubmitting}
      className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
    >
      <FilePlus2 className="mr-2 size-4" />
      {isSubmitting ? "กำลังสร้างบิล..." : "ตั้งเบิก / สร้างบิลค่าใช้จ่าย"}
    </Button>
  )
}
