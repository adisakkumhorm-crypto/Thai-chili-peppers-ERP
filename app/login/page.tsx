"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
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

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get("redirect") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Fix hydration issue from password managers
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  async function signIn(em: string, pw: string) {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw })
    setLoading(false)
    if (error) {
      toast.error("เข้าสู่ระบบไม่สำเร็จ", { description: error.message })
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  if (!mounted) {
    return <div className="flex min-h-svh items-center justify-center p-4"></div>
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4" suppressHydrationWarning>
      <Card className="w-full max-w-sm" suppressHydrationWarning>
        <CardHeader>
          <CardTitle className="text-xl">เข้าสู่ระบบ (Sign In)</CardTitle>
          <CardDescription>ระบบจัดการธุรกิจ Thai Chili Peppers ERP</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void signIn(email, password)
          }}
          suppressHydrationWarning
        >
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">รหัสผ่าน (Password)</Label>
                <Link href="/forgot-password" className="text-xs text-blue-500 hover:underline">
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>
          </CardContent>
          <CardFooter className="mt-2 flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              เข้าสู่ระบบ
            </Button>
            
            <div className="relative w-full text-center py-2">
              <span className="text-muted-foreground text-xs bg-card px-2 relative z-10">หรือ</span>
              <div className="absolute left-0 top-1/2 w-full border-t border-border"></div>
            </div>
            
            <Button variant="outline" type="button" className="w-full" render={<Link href="/signup" />}>
              สมัครสมาชิกใหม่
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
