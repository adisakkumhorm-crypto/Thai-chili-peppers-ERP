"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { approvePR, rejectPR, requestRevisionPR } from "../../actions"

export function ApprovalActions({ prId, isRequester, canApprove, price }: { prId: string, isRequester: boolean, canApprove: boolean, price: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject" | "revise" | null>(null)
  const [reason, setReason] = useState("")

  if (isRequester) {
    return (
      <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">ไม่อนุญาตให้อนุมัติรายการของตนเอง</h3>
        <p className="text-white/80">คุณเป็นผู้ขอจัดซื้อรายการนี้ กรุณาให้ผู้มีอำนาจอนุมัติท่านอื่นเป็นผู้ดำเนินการ</p>
      </div>
    )
  }

  if (!canApprove) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
        <h3 className="text-lg font-semibold text-red-400 mb-2">สิทธิ์การอนุมัติไม่เพียงพอ</h3>
        <p className="text-white/80">วงเงินหรือสิทธิ์ของคุณไม่เพียงพอสำหรับการอนุมัติยอด ฿{price.toFixed(2)}</p>
      </div>
    )
  }

  async function handleAction() {
    if ((actionType === 'reject' || actionType === 'revise') && !reason.trim()) {
      toast.error("กรุณาระบุเหตุผล")
      return
    }

    setLoading(true)
    let res;
    
    if (actionType === 'approve') {
      res = await approvePR({ pr_id: prId })
    } else if (actionType === 'reject') {
      res = await rejectPR({ pr_id: prId, reason })
    } else if (actionType === 'revise') {
      res = await requestRevisionPR({ pr_id: prId, reason })
    }

    setLoading(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success(actionType === 'approve' ? "อนุมัติรายการจัดซื้อสำเร็จ" : actionType === 'reject' ? "ปฏิเสธรายการจัดซื้อแล้ว" : "ส่งกลับให้แก้ไขเรียบร้อย")
      router.refresh()
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="font-semibold text-lg text-white border-b border-white/10 pb-4 mb-4">Approval Decision</h3>
      
      {!actionType ? (
        <div className="flex flex-wrap gap-4">
          <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => setActionType('approve')}>
            <CheckCircle className="w-4 h-4 mr-2" /> อนุมัติ (Approve)
          </Button>
          <Button variant="destructive" onClick={() => setActionType('reject')}>
            <XCircle className="w-4 h-4 mr-2" /> ไม่อนุมัติ (Reject)
          </Button>
          <Button variant="secondary" onClick={() => setActionType('revise')}>
            <RefreshCw className="w-4 h-4 mr-2" /> ส่งกลับไปแก้ไข (Request Revision)
          </Button>
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <h4 className={`font-semibold ${actionType === 'approve' ? 'text-green-400' : actionType === 'reject' ? 'text-red-400' : 'text-orange-400'}`}>
            ยืนยันการ{actionType === 'approve' ? "อนุมัติ" : actionType === 'reject' ? "ปฏิเสธ" : "ให้แก้ไข"}
          </h4>
          
          {(actionType === 'reject' || actionType === 'revise') && (
            <div className="space-y-2">
              <label className="text-white/70 text-sm">ระบุเหตุผล *</label>
              <textarea 
                required
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="อธิบายเหตุผลให้ฝ่ายจัดซื้อหรือผู้ขอจัดซื้อทราบ"
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm"
              />
            </div>
          )}

          {actionType === 'approve' && (
            <p className="text-white/80 text-sm">การอนุมัตินี้จะทำให้ PR พร้อมสำหรับการเปิดใบสั่งซื้อ (PO) ในขั้นตอนต่อไป</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setActionType(null); setReason(""); }}>ยกเลิก</Button>
            <Button 
              variant={actionType === 'approve' ? 'default' : actionType === 'reject' ? 'destructive' : 'secondary'}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={handleAction}
              disabled={loading}
            >
              {loading ? "กำลังบันทึก..." : "ยืนยัน (Confirm)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
