"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { signUp } from "@/app/signup/actions"
import { validatePassword } from "@/lib/auth/password"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Fix hydration issue from password managers
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Live policy check so the user sees every failing rule before submitting.
  const policy = validatePassword(password)
  const showPolicy = password.length > 0 && !policy.ok

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    const check = validatePassword(password)
    if (!check.ok) {
      toast.error("กรุณาตั้งรหัสผ่านให้ปลอดภัยยิ่งขึ้น", {
        description: check.issues.join(" "),
      })
      return
    }

    setLoading(true)
    const result = await signUp({ email, password })
    setLoading(false)

    if (!result.ok) {
      toast.error("สมัครสมาชิกไม่สำเร็จ", { description: result.error })
      return
    }
    setDone(true)
  }

  if (!mounted) {
    return <div className="flex min-h-svh items-center justify-center p-4"></div>
  }

  if (done) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-primary size-5" />
              <CardTitle className="text-xl">สมัครสมาชิกสำเร็จ</CardTitle>
            </div>
            <CardDescription>
              บัญชี <span className="font-medium">{email}</span> ถูกสร้างเรียบร้อยแล้ว<br /><br />
              ระบบได้ส่งคำขอเข้าร่วมทีมโดยอัตโนมัติ <b>กรุณารอคุณโออนุมัติสิทธิ์</b> จึงจะสามารถเข้าสู่ระบบได้ค่ะ
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/login" />}
            >
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
          <CardTitle className="text-xl">สมัครสมาชิกใหม่ (Sign Up)</CardTitle>
          <CardDescription>
            สร้างบัญชีเพื่อเข้าใช้งานระบบ Thai Chili Peppers ERP
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
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน (Password)</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={showPolicy}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {showPolicy ? (
                <ul className="text-destructive space-y-1 text-xs">
                  {policy.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">
                  ความยาวอย่างน้อย 6 ตัวอักษร
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="mt-2 flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !policy.ok || email.length === 0}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "สมัครสมาชิก (Create account)"
              )}
            </Button>
            
            <div className="relative w-full text-center py-2">
              <span className="text-muted-foreground text-xs bg-card px-2 relative z-10">หรือ</span>
              <div className="absolute left-0 top-1/2 w-full border-t border-border"></div>
            </div>
            
            <Button variant="outline" type="button" className="w-full" render={<Link href="/login" />}>
              มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
