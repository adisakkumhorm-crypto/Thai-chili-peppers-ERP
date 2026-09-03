"use client"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send } from "lucide-react"
import { createLeaveRequest } from "../actions"

const schema = z.object({
  type: z.enum(["sick", "personal", "vacation"]),
  start_date: z.string().min(1, "กรุณาเลือกวันที่เริ่มต้น"),
  end_date: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุด"),
  reason: z.string().optional().nullable(),
  is_unpaid: z.boolean().optional(),
})

export function LeaveRequestForm() {
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: "sick", start_date: "", end_date: "", reason: "", is_unpaid: false }
  })

  async function onSubmit(vals: z.infer<typeof schema>) {
    const res = await createLeaveRequest(vals)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("ส่งคำขอลาหยุดเรียบร้อยแล้ว")
      router.push("/my-leave")
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-white/80 font-semibold tracking-wide">ประเภทการลา</Label>
        <Select onValueChange={v => form.setValue("type", v as any)} value={form.watch("type")}>
          <SelectTrigger className="bg-black/40 border-white/10 text-white shadow-inner focus:ring-emerald-500/50 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10 text-white rounded-xl">
            <SelectItem value="sick" className="focus:bg-white/10 focus:text-white">🤧 ลาป่วย (Sick Leave)</SelectItem>
            <SelectItem value="personal" className="focus:bg-white/10 focus:text-white">📋 ลากิจ (Personal Leave)</SelectItem>
            <SelectItem value="vacation" className="focus:bg-white/10 focus:text-white">🏖️ ลาพักร้อน (Vacation)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-white/80 font-semibold tracking-wide">ตั้งแต่วันที่</Label>
          <Input type="date" {...form.register("start_date")} className="bg-black/40 border-white/10 text-white shadow-inner focus-visible:ring-emerald-500/50 rounded-xl" style={{ colorScheme: 'dark' }} />
          {form.formState.errors.start_date && <p className="text-rose-400 text-xs font-medium">{form.formState.errors.start_date.message}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-white/80 font-semibold tracking-wide">ถึงวันที่</Label>
          <Input type="date" {...form.register("end_date")} className="bg-black/40 border-white/10 text-white shadow-inner focus-visible:ring-emerald-500/50 rounded-xl" style={{ colorScheme: 'dark' }} />
          {form.formState.errors.end_date && <p className="text-rose-400 text-xs font-medium">{form.formState.errors.end_date.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-white/80 font-semibold tracking-wide">เหตุผลการลา (ถ้ามี)</Label>
        <Textarea {...form.register("reason")} placeholder="ระบุเหตุผลการลา..." className="bg-black/40 border-white/10 text-white shadow-inner focus-visible:ring-emerald-500/50 rounded-xl min-h-[100px] resize-none" />
      </div>
      <div className="flex justify-end pt-6">
        <Button type="submit" disabled={form.formState.isSubmitting} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] rounded-xl px-8 h-12 font-bold tracking-wide transition-all hover:scale-[1.02]">
          {form.formState.isSubmitting ? "กำลังส่งคำขอ..." : <><Send className="size-4 mr-2" /> ยื่นคำขอลาหยุด</>}
        </Button>
      </div>
    </form>
  )
}
