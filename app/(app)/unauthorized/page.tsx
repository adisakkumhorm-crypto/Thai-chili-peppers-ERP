import Link from "next/link"
import { ShieldAlert, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <ShieldAlert className="size-20 text-destructive/80" />
      <h1 className="text-3xl font-bold">Access Denied (ถูกจำกัดสิทธิ์)</h1>
      <p className="text-muted-foreground max-w-md mt-2">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (Unauthorized Role) <br/>
        ข้อมูลนี้สงวนไว้สำหรับระดับสิทธิ์ที่สูงกว่า กรุณาติดต่อ HR หรือผู้ดูแลระบบ
      </p>
      <div className="pt-6">
        <Button render={<Link href="/dashboard" />}>
          <ArrowLeft className="mr-2 size-4" /> กลับหน้าหลัก (Dashboard)
        </Button>
      </div>
    </div>
  )
}
