"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createEmployee } from "../../actions"

const EmployeeInput = z.object({
  employee_code: z.string().min(1, "Required"),
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  nickname: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  daily_wage: z.coerce.number().min(0),
  employment_type: z.enum(["monthly", "daily", "part_time"]).default("monthly"),
  qr_code: z.string().optional().nullable(),
  shift_id: z.string().optional().nullable(),
  role: z.enum(["admin", "foreman", "staff"]).default("staff"),
})

type EmployeeFormValues = z.infer<typeof EmployeeInput>

export function EmployeeForm({ shifts = [] }: { shifts?: any[] }) {
  const [loading, setLoading] = useState(false)
  
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeInput) as any,
    defaultValues: {
      employee_code: "",
      first_name: "",
      last_name: "",
      nickname: "",
      position: "",
      department: "",
      daily_wage: 350,
      employment_type: "monthly",
      qr_code: "",
      shift_id: "",
      role: "staff"
    }
  })

  async function onSubmit(data: EmployeeFormValues) {
    setLoading(true)
    const res = await createEmployee(data)
    setLoading(false)
    if (res?.error) {
      toast.error(res.error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>รหัสพนักงาน (Employee Code)</Label>
          <Input {...form.register("employee_code")} placeholder="e.g. EMP-001" />
        </div>
        <div className="space-y-2">
          <Label>สิทธิ์การใช้งานระบบ (Role)</Label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            {...form.register("role")}
          >
            <option value="staff">พนักงานทั่วไป (Staff)</option>
            <option value="foreman">โฟร์แมน / หัวหน้างาน (Foreman)</option>
            <option value="admin">ผู้จัดการ / แอดมิน (Admin)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>ชื่อ (First Name)</Label>
          <Input {...form.register("first_name")} />
        </div>
        <div className="space-y-2">
          <Label>นามสกุล (Last Name)</Label>
          <Input {...form.register("last_name")} />
        </div>
        <div className="space-y-2">
          <Label>ชื่อเล่น (Nickname)</Label>
          <Input {...form.register("nickname")} />
        </div>
        <div className="space-y-2">
          <Label>ตำแหน่ง (Position)</Label>
          <Input {...form.register("position")} />
        </div>
        <div className="space-y-2">
          <Label>แผนก (Department)</Label>
          <Input {...form.register("department")} />
        </div>
        
        <div className="space-y-2">
          <Label>ประเภทการจ้างงาน (Employment Type)</Label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            {...form.register("employment_type")}
          >
            <option value="monthly">รายเดือน (Monthly)</option>
            <option value="daily">รายวัน (Daily)</option>
            <option value="part_time">พาร์ทไทม์ (Part-time)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>กะการทำงาน (Shift)</Label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            {...form.register("shift_id")}
          >
            <option value="">-- ไม่ระบุ --</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>ค่าแรง / ฐานเงินเดือน (Wage / Salary)</Label>
          <Input type="number" {...form.register("daily_wage")} />
        </div>
      </div>
      
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        บันทึกข้อมูล
      </Button>
    </form>
  )
}
