"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Trash2, CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { updateWorkingDays, addPublicHoliday, deletePublicHoliday, updatePayrollSettings } from "../actions"

const DAYS = [
  { id: 1, label: "จันทร์" },
  { id: 2, label: "อังคาร" },
  { id: 3, label: "พุธ" },
  { id: 4, label: "พฤหัสบดี" },
  { id: 5, label: "ศุกร์" },
  { id: 6, label: "เสาร์" },
  { id: 0, label: "อาทิตย์" },
]

import { createShift, deleteShift } from "../actions"

export function HRSettingsClient({ initialWorkingDays, initialHolidays, initialOtRate, initialLatePenalty, initialShifts = [] }: { initialWorkingDays: number[], initialHolidays: any[], initialOtRate: number, initialLatePenalty: number, initialShifts?: any[] }) {
  const [workingDays, setWorkingDays] = useState<number[]>(initialWorkingDays)
  const [date, setDate] = useState("")
  const [name, setName] = useState("")
  const [savingDays, setSavingDays] = useState(false)
  const [addingHol, setAddingHol] = useState(false)
  const [otRate, setOtRate] = useState(initialOtRate)
  const [latePenalty, setLatePenalty] = useState(initialLatePenalty)
  const [savingPayroll, setSavingPayroll] = useState(false)
  const [shifts, setShifts] = useState<any[]>(initialShifts || [])
  const [shiftName, setShiftName] = useState("")
  const [shiftStart, setShiftStart] = useState("08:00")
  const [shiftEnd, setShiftEnd] = useState("17:00")
  const [shiftBreak, setShiftBreak] = useState(60)
  const [addingShift, setAddingHolShift] = useState(false)

  async function handleSavePayroll() {
    setSavingPayroll(true)
    await updatePayrollSettings(otRate, latePenalty)
    toast.success("บันทึกการตั้งค่าเงินเดือนเรียบร้อย")
    setSavingPayroll(false)
  }

  async function handleSaveDays() {
    setSavingDays(true)
    await updateWorkingDays(workingDays)
    toast.success("บันทึกวันทำงานเรียบร้อยแล้ว")
    setSavingDays(false)
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !name) return toast.error("กรุณากรอกข้อมูลให้ครบ")
    setAddingHol(true)
    const res = await addPublicHoliday(date, name)
    setAddingHol(false)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("เพิ่มวันหยุดเรียบร้อยแล้ว")
      setDate("")
      setName("")
    }
  }

  async function handleDelete(id: string) {
    if(!confirm("ต้องการลบวันหยุดนี้?")) return;
    await deletePublicHoliday(id)
    toast.success("ลบวันหยุดเรียบร้อยแล้ว")
  }

  
  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    if (!shiftName || !shiftStart || !shiftEnd) return toast.error("กรุณากรอกข้อมูลให้ครบ")
    setAddingHolShift(true)
    const res = await createShift(shiftName, shiftStart + ":00", shiftEnd + ":00", shiftBreak)
    setAddingHolShift(false)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("เพิ่มกะการทำงานเรียบร้อย")
      setShiftName("")
      // Will refresh via server action revalidatePath, but we can optimistically reload
      window.location.reload()
    }
  }

  async function handleDeleteShift(id: string) {
    if(!confirm("ต้องการลบกะการทำงานนี้? พนักงานที่ผูกกับกะนี้จะไม่มีกะการทำงาน")) return;
    const res = await deleteShift(id)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("ลบกะการทำงานเรียบร้อยแล้ว")
      window.location.reload()
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">วันทำงานปกติ (Working Days)</CardTitle>
          <CardDescription>เลือกวันที่บริษัทเปิดทำการ เพื่อใช้คำนวณวันลา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            {DAYS.map(d => (
              <label key={d.id} className="flex items-center gap-3">
                <Checkbox 
                  checked={workingDays.includes(d.id)} 
                  onCheckedChange={(checked) => {
                    if (checked) setWorkingDays([...workingDays, d.id])
                    else setWorkingDays(workingDays.filter(x => x !== d.id))
                  }}
                />
                <span className="text-sm">{d.label}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleSaveDays} disabled={savingDays}>
            {savingDays ? "กำลังบันทึก..." : "บันทึกวันทำงาน"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">วันหยุดนักขัตฤกษ์ (Public Holidays)</CardTitle>
          <CardDescription>เพิ่มวันหยุดพิเศษของบริษัท ระบบจะไม่นับเป็นวันลา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddHoliday} className="flex flex-col gap-3 p-4 bg-muted/20 rounded-lg border">
            <div className="space-y-1">
              <Label>วันที่หยุด</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ colorScheme: 'dark' }} />
            </div>
            <div className="space-y-1">
              <Label>ชื่อวันหยุด</Label>
              <Input placeholder="เช่น วันปีใหม่" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <Button type="submit" size="sm" disabled={addingHol}>
              {addingHol ? "กำลังเพิ่ม..." : "เพิ่มวันหยุด"}
            </Button>
          </form>

          <div className="space-y-2">
            <Label>รายการวันหยุด</Label>
            {initialHolidays.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">ยังไม่มีวันหยุดนักขัตฤกษ์</p>
            ) : (
              <ul className="divide-y border rounded-md">
                {initialHolidays.map((h: any) => (
                  <li key={h.id} className="p-3 flex items-center justify-between hover:bg-muted/30">
                    <div>
                      <div className="font-medium text-sm">{h.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(h.date).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(h.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    
      
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">กะการทำงาน (Work Shifts)</CardTitle>
          <CardDescription>สร้างกะการทำงานเพื่อนำไปผูกกับพนักงาน ใช้สำหรับคำนวณการมาสายและ OT</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddShift} className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 bg-muted/20 rounded-lg border items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label>ชื่อกะ (เช่น กะเช้า)</Label>
              <Input placeholder="ระบุชื่อกะ" value={shiftName} onChange={e => setShiftName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>เวลาเข้า</Label>
              <Input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} required style={{ colorScheme: 'dark' }} />
            </div>
            <div className="space-y-1">
              <Label>เวลาออก</Label>
              <Input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} required style={{ colorScheme: 'dark' }} />
            </div>
            <Button type="submit" disabled={addingShift}>
              {addingShift ? "กำลังเพิ่ม..." : "เพิ่มกะ"}
            </Button>
          </form>

          <div className="space-y-2">
            <Label>รายการกะการทำงาน</Label>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">ยังไม่มีการตั้งค่ากะการทำงาน</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shifts.map((s: any) => (
                  <div key={s.id} className="p-3 border rounded-md relative group bg-card">
                    <div className="font-bold text-sm text-emerald-400 mb-1">{s.name}</div>
                    <div className="text-xs text-muted-foreground">เวลาเข้า: <span className="text-white">{s.start_time.slice(0,5)}</span> น.</div>
                    <div className="text-xs text-muted-foreground">เวลาออก: <span className="text-white">{s.end_time.slice(0,5)}</span> น.</div>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteShift(s.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">ตั้งค่าเงินเดือน & การหักเงิน (Payroll Settings)</CardTitle>
          <CardDescription>กำหนดเรทการทำงานล่วงเวลา (OT) และอัตราการหักเงินกรณีมาสาย</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>ค่าล่วงเวลา (OT) / ชั่วโมง</Label>
              <Input type="number" min="0" value={otRate} onChange={e => setOtRate(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>หักเงินมาสาย / นาที</Label>
              <Input type="number" min="0" value={latePenalty} onChange={e => setLatePenalty(Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={handleSavePayroll} disabled={savingPayroll}>
            {savingPayroll ? "กำลังบันทึก..." : "บันทึกตั้งค่าเงินเดือน"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
