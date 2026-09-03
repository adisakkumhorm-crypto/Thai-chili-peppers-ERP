import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { LeaveRequestForm } from "../_components/leave-request-form"

export default function NewLeaveRequestPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="ยื่นใบลา (Request Leave)" description="กรอกข้อมูลเพื่อส่งคำขอลาหยุดให้หัวหน้า/HR อนุมัติ">
        <Button variant="ghost" size="sm" render={<Link href="/my-leave" />}>
          <ArrowLeft /> กลับไปที่ศูนย์บริการพนักงาน
        </Button>
      </PageHeader>
      <div className="p-8 border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md shadow-inner">
        <LeaveRequestForm />
      </div>
    </div>
  )
}
