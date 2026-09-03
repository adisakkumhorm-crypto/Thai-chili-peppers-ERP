import Link from "next/link"
import { Plus, Calendar, CheckCircle2, Clock, DollarSign, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

function LeaveStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-500 hover:bg-emerald-600">อนุมัติแล้ว</Badge>
  if (status === "rejected") return <Badge variant="destructive">ไม่อนุมัติ</Badge>
  return <Badge variant="secondary" className="text-amber-600 bg-amber-50">รออนุมัติ</Badge>
}

export default async function MyLeavePage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()

  // Get employee linked to this user
  const { data: emp } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  if (!emp) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
           <div>
             <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">ศูนย์บริการพนักงาน (Employee Portal)</h1>
             <p className="text-sm text-white/50 mt-1">แจ้งลางาน เบิกเงิน เบิกของช่าง ออนไลน์</p>
           </div>
        </div>
        <div className="p-12 text-center text-white/50 border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md shadow-inner">
          <Calendar className="size-16 mx-auto text-white/20 mb-4 drop-shadow-md" />
          <h2 className="text-lg font-bold text-white/90">ไม่พบข้อมูลพนักงาน</h2>
          <p className="mt-2">บัญชีผู้ใช้นี้ยังไม่ได้ผูกกับประวัติพนักงานในระบบ กรุณาแจ้ง HR ให้ดำเนินการผูกบัญชี</p>
        </div>
      </div>
    )
  }

  const year = new Date().getFullYear()
  
  const [balancesRes, requestsRes] = await Promise.all([
    supabase.from("leave_balances").select("*").eq("employee_id", emp.id).eq("year", year).maybeSingle(),
    supabase.from("leave_requests").select("*").eq("employee_id", emp.id).order("created_at", { ascending: false })
  ])

  const balance = balancesRes.data
  const requests = requestsRes.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
         <div>
           <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">ศูนย์บริการพนักงาน (Employee Portal)</h1>
           <p className="text-sm text-white/50 mt-1">สิทธิ์การลาปี {year} ของคุณ {emp.first_name} {emp.last_name}</p>
         </div>
      </div>

      {/* 🚀 Quick Actions Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/my-leave/new" className="relative p-6 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/30 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),0_10px_20px_-5px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center gap-3 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 group overflow-hidden">
          <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner group-hover:scale-110 transition-transform duration-300">
             <Calendar className="size-8 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          </div>
          <span className="font-bold text-lg text-white/90 tracking-wide mt-1">ยื่นลางาน</span>
        </Link>

        <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center gap-3 opacity-60 grayscale-[30%] cursor-not-allowed overflow-hidden">
          <Badge className="absolute top-4 right-4 bg-white/10 text-white/60 border-white/10">เร็วๆ นี้</Badge>
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
             <DollarSign className="size-8" />
          </div>
          <span className="font-bold text-lg text-white/70 tracking-wide mt-1">เบิกเงินสำรองจ่าย</span>
        </div>

        <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center gap-3 opacity-60 grayscale-[30%] cursor-not-allowed overflow-hidden">
          <Badge className="absolute top-4 right-4 bg-white/10 text-white/60 border-white/10">เร็วๆ นี้</Badge>
          <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shadow-inner">
             <Package className="size-8" />
          </div>
          <span className="font-bold text-lg text-white/70 tracking-wide mt-1">เบิกอุปกรณ์ช่าง</span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest mt-8 mb-4">สิทธิ์การลาคงเหลือ</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Liquid Glass Card 1 */}
        <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),0_10px_20px_-5px_rgba(0,0,0,0.3)] group overflow-hidden">
           <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 shadow-inner">
               <CheckCircle2 className="size-5 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
             </div>
             <span className="text-sm font-bold text-white/90 tracking-wide">ลาป่วย (Sick)</span>
           </div>
           <div className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
             {(balance?.sick_total ?? 0) - (balance?.sick_used ?? 0)} <span className="text-sm font-bold text-blue-300/60">/ {balance?.sick_total ?? 0} วัน</span>
           </div>
           <div className="text-xs text-blue-200/60 mt-2 font-medium">ใช้ไปแล้ว {balance?.sick_used ?? 0} วัน</div>
        </div>

        {/* Liquid Glass Card 2 */}
        <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),0_10px_20px_-5px_rgba(0,0,0,0.3)] group overflow-hidden">
           <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-inner">
               <Clock className="size-5 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
             </div>
             <span className="text-sm font-bold text-white/90 tracking-wide">ลากิจ (Personal)</span>
           </div>
           <div className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
             {(balance?.personal_total ?? 0) - (balance?.personal_used ?? 0)} <span className="text-sm font-bold text-amber-300/60">/ {balance?.personal_total ?? 0} วัน</span>
           </div>
           <div className="text-xs text-amber-200/60 mt-2 font-medium">ใช้ไปแล้ว {balance?.personal_used ?? 0} วัน</div>
        </div>

        {/* Liquid Glass Card 3 */}
        <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 backdrop-blur-[40px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),0_10px_20px_-5px_rgba(0,0,0,0.3)] group overflow-hidden">
           <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
               <Calendar className="size-5 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
             </div>
             <span className="text-sm font-bold text-white/90 tracking-wide">ลาพักร้อน (Vacation)</span>
           </div>
           <div className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
             {(balance?.vacation_total ?? 0) - (balance?.vacation_used ?? 0)} <span className="text-sm font-bold text-emerald-300/60">/ {balance?.vacation_total ?? 0} วัน</span>
           </div>
           <div className="text-xs text-emerald-200/60 mt-2 font-medium">ใช้ไปแล้ว {balance?.vacation_used ?? 0} วัน</div>
        </div>
      </div>

      {/* Transparent Glass Table */}
      <div className="rounded-[2.5rem] bg-white/[0.02] border border-white/[0.08] backdrop-blur-[50px] shadow-[inset_0_2px_15px_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-6 border-b border-white/[0.08] bg-white/[0.01]">
          <h2 className="text-base font-bold text-white/90">ประวัติการยื่นเรื่อง</h2>
        </div>
          {requests.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-sm">
              ยังไม่มีประวัติการยื่นใบลา
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-white/[0.02] text-left text-white/60">
                    <th className="p-4 font-semibold uppercase tracking-wider text-xs">วันที่ยื่นเรื่อง</th>
                    <th className="p-4 font-semibold uppercase tracking-wider text-xs">ประเภทการลา</th>
                    <th className="p-4 font-semibold uppercase tracking-wider text-xs">ช่วงเวลาที่ลา</th>
                    <th className="p-4 font-semibold uppercase tracking-wider text-xs">เหตุผล</th>
                    <th className="p-4 font-semibold uppercase tracking-wider text-xs text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="p-4 text-white/50">{new Date(req.created_at).toLocaleDateString('th-TH', { timeZone: ctx.timezone })}</td>
                      <td className="p-4 font-bold text-white/90 capitalize">{req.type === 'sick' ? 'ลาป่วย' : req.type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}</td>
                      <td className="p-4 text-white/70">
                        {new Date(req.start_date as string).toLocaleDateString('th-TH', { timeZone: ctx.timezone })} 
                        {(req.start_date as string) !== (req.end_date as string) && ` - ${new Date(req.end_date as string).toLocaleDateString('th-TH', { timeZone: ctx.timezone })}`}
                      </td>
                      <td className="p-4 text-white/50 max-w-[200px] truncate">{(req.reason as string) || "—"}</td>
                      <td className="p-4 text-center"><LeaveStatusBadge status={req.status || "pending"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}
