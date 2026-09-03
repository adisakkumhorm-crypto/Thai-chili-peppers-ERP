"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { validatePassword } from "@/lib/auth/password"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const policy = validatePassword(password)
  const showPolicy = password.length > 0 && !policy.ok
  const passwordMismatch = password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!policy.ok) {
      toast.error("รหัสผ่านไม่ปลอดภัยพอ", { description: policy.issues.join(" ") })
      return
    }

    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: password })
    setLoading(false)

    if (error) {
      toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ", { description: error.message })
      return
    }

    toast.success("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", { description: "คุณสามารถใช้งานระบบด้วยรหัสผ่านใหม่ได้ทันที" })
    router.push("/dashboard")
  }

  if (!mounted) return <div className="flex min-h-svh items-center justify-center p-4"></div>

  return (
    <div className="flex min-h-svh items-center justify-center p-4" suppressHydrationWarning>
      <Card className="w-full max-w-sm" suppressHydrationWarning>
        <CardHeader>
          <CardTitle className="text-xl">ตั้งรหัสผ่านใหม่</CardTitle>
          <CardDescription>
            กรุณาตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} suppressHydrationWarning>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่านใหม่ (New Password)</Label>
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
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                  ความยาว 10 ตัวอักษร พิมพ์ใหญ่ พิมพ์เล็ก และตัวเลข
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน (Confirm Password)</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {passwordMismatch && (
                <p className="text-destructive text-xs">รหัสผ่านไม่ตรงกัน</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="mt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !policy.ok || passwordMismatch || !password}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              บันทึกรหัสผ่านใหม่
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
