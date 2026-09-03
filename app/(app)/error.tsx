"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("App module caught error:", error)
  }, [error])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 bg-slate-900/20 rounded-3xl border border-red-500/10 backdrop-blur-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white/90">ระบบส่วนนี้เกิดข้อผิดพลาดชั่วคราว</h2>
        <p className="text-sm text-white/50 max-w-md">
          ไม่ต้องตกใจนะคะ คัทเอาท์ตัดไฟทำงานแล้ว ระบบหน้าต่างอื่นๆ ยังใช้งานได้ปกติค่ะ<br/>
          <span className="text-xs text-red-400/70 font-mono mt-2 block bg-black/20 p-2 rounded">
            Error: {error.message || "Unknown error"}
          </span>
        </p>
      </div>
      <Button 
        variant="outline" 
        onClick={() => reset()}
        className="mt-4 border-white/10 hover:bg-white/10 text-white/80"
      >
        ลองโหลดโค้ดส่วนนี้ใหม่
      </Button>
    </div>
  )
}