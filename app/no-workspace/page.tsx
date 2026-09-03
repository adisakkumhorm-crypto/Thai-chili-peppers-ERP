import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Clock, Send } from "lucide-react"
import { requestAccess } from "./actions"

export const dynamic = "force-dynamic"

export default async function NoWorkspacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  if (!user) redirect("/login")

  // Already a member? Send them into the app.
  const ctx = await getOrgContext()
  if (ctx) redirect("/dashboard")

  
  // Check if they already requested access
  let { data: existingRequest } = await (supabase as any)
    .from("join_requests")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle()

  // AUTO-JOIN LOGIC: If no request exists, automatically create one so they don't have to click the button
  if (!existingRequest) {
    const adminClient = createAdminClient()
    const { data: org } = await adminClient.from("organizations").select("id").limit(1).single()
    if (org) {
      const { error: insertErr } = await adminClient.from("join_requests" as any).insert({
        user_id: user.id,
        org_id: org.id,
        status: "pending"
      })
      if (!insertErr) {
        existingRequest = { status: "pending" }
      }
    }
  }

  const isPending = existingRequest?.status === "pending"

  const isRejected = existingRequest?.status === "rejected"

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm border-white/10 bg-slate-950/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-xl">ยินดีต้อนรับสู่ ERP</CardTitle>
          <CardDescription>
            บัญชีของคุณ {user.email ? `(${user.email})` : ""} สมัครสมาชิกสำเร็จแล้ว
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isPending ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <Clock className="size-10 text-yellow-500 animate-pulse" />
              <div>
                <p className="font-medium text-yellow-500">รอการอนุมัติ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  คำขอของคุณถูกส่งไปยังผู้ดูแลระบบแล้ว โปรดรอคุณโออนุมัติสิทธิ์เข้าใช้งาน
                </p>
              </div>
            </div>
          ) : isRejected ? (
             <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-red-500/10 border border-red-500/20 rounded-lg">
               <div>
                 <p className="font-medium text-red-500">คำขอถูกปฏิเสธ</p>
                 <p className="text-sm text-muted-foreground mt-1">
                   ไม่สามารถเข้าสู่ระบบได้ โปรดติดต่อผู้ดูแลระบบ
                 </p>
               </div>
             </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              เพื่อความปลอดภัยของข้อมูล คุณจำเป็นต้องส่งคำขอเข้าใช้งานและรอให้ผู้ดูแลระบบ (Admin) อนุมัติก่อนเข้าสู่ระบบ
              
              <form action={requestAccess} className="mt-6">
                <Button type="submit" className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  ส่งคำขอเข้าใช้งาน
                </Button>
              </form>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-4 border-t border-white/5">
          <form action="/auth/signout" method="post" className="w-full">
            <Button type="submit" variant="ghost" className="w-full text-muted-foreground hover:text-white">
              ออกจากระบบ
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
