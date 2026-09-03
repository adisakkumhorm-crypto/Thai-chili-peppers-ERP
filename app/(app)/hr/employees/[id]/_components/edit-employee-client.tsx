"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateEmployee } from "../actions"
import { Checkbox } from "@/components/ui/checkbox"

export function EditEmployeeClient({ employee, initialBalance, currentYear, shifts = [] }: { employee: any, initialBalance: any, currentYear: number, shifts?: any[] }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    first_name: employee.first_name || "",
    last_name: employee.last_name || "",
    nickname: employee.nickname || "",
    position: employee.position || "",
    department: employee.department || "",
    daily_wage: employee.daily_wage || 0,
    employment_type: employee.employment_type || "monthly",
    role: employee.role || "staff",
    is_active: employee.is_active ?? true,
    shift_id: employee.shift_id || "",
    balance: initialBalance ? {
      year: currentYear,
      sick_total: initialBalance.sick_total,
      personal_total: initialBalance.personal_total,
      vacation_total: initialBalance.vacation_total,
      sick_used: initialBalance.sick_used,
      personal_used: initialBalance.personal_used,
      vacation_used: initialBalance.vacation_used,
    } : {
      year: currentYear,
      sick_total: 30,
      personal_total: 6,
      vacation_total: 6,
      sick_used: 0,
      personal_used: 0,
      vacation_used: 0,
    }
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await updateEmployee(employee.id, formData)
    setLoading(false)
    if (res?.error) toast.error(res.error)
    else toast.success("บันทึกข้อมูลเรียบร้อยแล้ว")
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลพนักงาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>ชื่อ (First Name)</Label>
                <Input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label>นามสกุล (Last Name)</Label>
                <Input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label>ชื่อเล่น</Label>
                <Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>สถานะ</Label>
                <div className="flex items-center gap-2 h-9">
                  <Checkbox checked={formData.is_active} onCheckedChange={c => setFormData({...formData, is_active: !!c})} />
                  <span className="text-sm">Active (ทำงานอยู่)</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>ตำแหน่ง</Label>
                <Input value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>แผนก</Label>
                <Input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>ประเภทการจ้าง</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.employment_type}
                  onChange={e => setFormData({...formData, employment_type: e.target.value})}
                >
                  <option value="monthly">รายเดือน (Monthly)</option>
                  <option value="daily">รายวัน (Daily)</option>
                  <option value="part_time">พาร์ทไทม์ (Part-time)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>ค่าแรง / เงินเดือน</Label>
                <Input type="number" value={formData.daily_wage} onChange={e => setFormData({...formData, daily_wage: Number(e.target.value)})} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>สิทธิ์ในระบบ (Role)</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="staff">พนักงานทั่วไป (Staff)</option>
                  <option value="foreman">โฟร์แมน / หัวหน้างาน (Foreman)</option>
                  <option value="admin">แอดมิน (Admin)</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>กะการทำงาน (Shift)</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.shift_id}
                  onChange={e => setFormData({...formData, shift_id: e.target.value})}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {shifts?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">โควตาวันลา (ปี {currentYear})</CardTitle>
            <CardDescription>ปรับจำนวนวันลาที่ได้ และวันลาที่ใช้ไป (ยกยอดลาพักร้อนมาบวกเพิ่มตรงนี้ได้เลย)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 items-end bg-muted/20 p-3 rounded-md border">
                <div className="space-y-1">
                  <Label>ลาป่วย (ทั้งหมด)</Label>
                  <Input type="number" value={formData.balance.sick_total} onChange={e => setFormData({...formData, balance: {...formData.balance, sick_total: Number(e.target.value)}})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-amber-500">ลาป่วย (ใช้ไป)</Label>
                  <Input type="number" value={formData.balance.sick_used} onChange={e => setFormData({...formData, balance: {...formData.balance, sick_used: Number(e.target.value)}})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end bg-muted/20 p-3 rounded-md border">
                <div className="space-y-1">
                  <Label>ลากิจ (ทั้งหมด)</Label>
                  <Input type="number" value={formData.balance.personal_total} onChange={e => setFormData({...formData, balance: {...formData.balance, personal_total: Number(e.target.value)}})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-amber-500">ลากิจ (ใช้ไป)</Label>
                  <Input type="number" value={formData.balance.personal_used} onChange={e => setFormData({...formData, balance: {...formData.balance, personal_used: Number(e.target.value)}})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end bg-muted/20 p-3 rounded-md border">
                <div className="space-y-1">
                  <Label>ลาพักร้อน (ทั้งหมด) <span className="text-emerald-500 font-bold">*</span></Label>
                  <Input type="number" value={formData.balance.vacation_total} onChange={e => setFormData({...formData, balance: {...formData.balance, vacation_total: Number(e.target.value)}})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-amber-500">ลาพักร้อน (ใช้ไป)</Label>
                  <Input type="number" value={formData.balance.vacation_used} onChange={e => setFormData({...formData, balance: {...formData.balance, vacation_used: Number(e.target.value)}})} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                <span className="text-emerald-500 font-bold">*</span> สามารถปรับเพิ่มโควตาลาพักร้อนรวม สำหรับพนักงานที่มียอดยกมาจากปีที่แล้วได้
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="w-full md:w-auto px-8">
          {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลพนักงาน"}
        </Button>
      </div>
    </form>
  )
}
