"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { removeMember } from "../actions"

export function RemoveMemberButton({ userId, orgId, memberName }: { userId: string, orgId: string, memberName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  
  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await removeMember({ userId, orgId })
    setLoading(false)
    if (res?.error) {
      toast.error("เกิดข้อผิดพลาด", { description: res.error })
    } else {
      setOpen(false)
      setTimeout(() => {
        toast.success(`ลบ ${memberName} ออกจากระบบเรียบร้อยแล้ว`)
        router.refresh()
      }, 300)
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); setOpen(true); }} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full h-8 w-8 ml-2 transition-colors">
        <Trash2 className="size-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="bg-slate-900 border border-white/10 text-white shadow-2xl backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-400 flex items-center gap-2">
            <Trash2 className="size-5" /> ยืนยันการลบผู้ใช้งาน
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300 text-sm mt-2">
            คุณต้องการลบสิทธิ์การเข้าถึงของ <b className="text-white bg-white/10 px-1 py-0.5 rounded">{memberName}</b> ใช่หรือไม่?
            <br /><br />
            การกระทำนี้จะลบข้อมูลพนักงานและการเป็นสมาชิกในองค์กรนี้อย่างถาวร พนักงานคนนี้จะไม่สามารถเข้าถึงระบบได้อีกจนกว่าจะได้รับการอนุมัติใหม่
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="bg-white/5 border-transparent hover:bg-white/10 text-white hover:text-white transition-colors">ยกเลิก</AlertDialogCancel>
          <Button variant="destructive" onClick={handleRemove} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white font-medium">
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            ยืนยันการลบ
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
