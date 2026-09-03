"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    
    setLoading(false)

    if (error) {
      toast.error("เกิดข้อผิดพลาด", { description: error.message })
      return
    }
    setDone(true)
  }

  if (!mounted) return <div className="flex min-h-svh items-center justify-center p-4"></div>

  if (done) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-primary size-5" />
              <CardTitle className="text-xl">ตรวจสอบอีเมลของคุณ</CardTitle>
            </div>
            <CardDescription>
              เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปที่ <b>{email}</b> แล้ว กรุณาตรวจสอบในกล่องจดหมายของคุณ (ถ้าไม่พบโปรดตรวจสอบในโฟลเดอร์จดหมายขยะ)
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" render={<Link href="/login" />}>
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4" suppressHydrationWarning>
      <Card className="w-full max-w-sm" suppressHydrationWarning>
        <CardHeader>
          <CardTitle className="text-xl">ลืมรหัสผ่าน?</CardTitle>
          <CardDescription>
            กรอกอีเมลที่ใช้สมัครบัญชี เพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} suppressHydrationWarning>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล (Email)</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="mt-2 flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              ส่งลิงก์รีเซ็ตรหัสผ่าน
            </Button>
            <Button variant="ghost" type="button" className="w-full text-muted-foreground" render={<Link href="/login" />}>
              <ArrowLeft className="mr-2 size-4" /> กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
