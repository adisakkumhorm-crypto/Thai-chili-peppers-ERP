"use client"

import { useState } from "react"
import { Key, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { updateUserPassword } from "../actions"

export function ResetPasswordButton({ userId, memberName }: { userId: string; memberName: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")
      return
    }

    setLoading(true)
    const res = await updateUserPassword({ userId, newPassword: password })
    setLoading(false)

    if (res?.error) {
      toast.error("เกิดข้อผิดพลาด", { description: res.error })
    } else {
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ", { description: `ตั้งรหัสผ่านใหม่ให้ ${memberName} เรียบร้อยแล้ว` })
      setOpen(false)
      setPassword("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500 ml-1" title="เปลี่ยนรหัสผ่าน">
          <Key className="size-4" />
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ตั้งรหัสผ่านใหม่ (Reset Password)</DialogTitle>
          <DialogDescription>
            ตั้งรหัสผ่านใหม่สำหรับ <b>{memberName}</b> พนักงานสามารถนำรหัสผ่านนี้ไปใช้เข้าสู่ระบบได้ทันทีโดยไม่ต้องรออีเมล
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="password">รหัสผ่านใหม่ (เห็นตัวอักษร)</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="พิมพ์รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                required
                minLength={6}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={loading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              บันทึกรหัสผ่าน
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
