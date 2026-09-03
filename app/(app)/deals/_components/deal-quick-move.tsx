"use client"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { updateDealStage } from "../actions"
import { toast } from "sonner"

export function DealQuickMove({ id, nextStage }: { id: string; nextStage: string }) {
  const [loading, setLoading] = useState(false)

  async function handleMove(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    const res = await updateDealStage(id, nextStage)
    setLoading(false)
    if (res?.error) {
      toast.error("อัปเดตสถานะไม่สำเร็จ", { description: res.error })
    } else {
      toast.success("เลื่อนสถานะสำเร็จ! 🎉")
    }
  }

  return (
    <button 
      className="flex size-7 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.6)] hover:from-blue-400 hover:to-indigo-400 hover:scale-110 transition-all border border-blue-400/50 z-20 cursor-pointer" 
      onClick={handleMove}
      disabled={loading}
      title="ย้ายไปขั้นถัดไป"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
    </button>
  )
}