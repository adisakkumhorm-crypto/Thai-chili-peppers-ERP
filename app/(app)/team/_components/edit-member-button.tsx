"use client"

import { useState } from "react"
import { Pencil, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { updateMemberFeatures } from "../actions"

import { NAV_ITEMS } from "@/components/nav"

const AVAILABLE_FEATURES = NAV_ITEMS.filter(item => !item.isBasic).map(item => ({
  id: item.href,
  label: item.title
}))

export function EditMemberButton({ 
  userId, 
  orgId, 
  memberName, 
  currentRole,
  currentFeatures 
}: { 
  userId: string, 
  orgId: string, 
  memberName: string,
  currentRole: string,
  currentFeatures: string[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  
  const [empRole, setEmpRole] = useState(currentRole)
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>(currentFeatures)

  const handleUpdate = async () => {
    setLoading(true)
    
    // Auto grant all features for admin/executive
    const finalFeatures = (empRole === "admin" || empRole === "executive" || empRole === "owner") 
      ? AVAILABLE_FEATURES.map(f => f.id) 
      : allowedFeatures

    const res = await updateMemberFeatures({ 
      userId, 
      orgId, 
      employeeRole: empRole,
      allowedFeatures: finalFeatures
    })
    
    setLoading(false)
    if (res?.error) {
      toast.error("เกิดข้อผิดพลาด", { description: res.error })
    } else {
      setOpen(false)
      setTimeout(() => {
        toast.success(`อัปเดตสิทธิ์ของ ${memberName} เรียบร้อยแล้ว`)
        router.refresh()
      }, 300)
    }
  }

  const toggleFeature = (featureId: string) => {
    setAllowedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    )
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-full h-8 w-8 ml-1 transition-colors">
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-900 border border-white/10 text-white shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>แก้ไขสิทธิ์พนักงาน</DialogTitle>
          <DialogDescription className="text-slate-400">
            ปรับเปลี่ยนระดับสิทธิ์และการเข้าถึงฟังก์ชันของ <b className="text-white">{memberName}</b>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">ระดับสิทธิ์ของพนักงาน (Role Level)</Label>
            <Select value={empRole} onValueChange={(v: any) => setEmpRole(v)}>
              <SelectTrigger className="bg-slate-950/50 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                <SelectItem value="staff">พนักงานทั่วไป (Staff)</SelectItem>
                <SelectItem value="foreman">หัวหน้างาน (Foreman)</SelectItem>
                <SelectItem value="manager">ผู้จัดการ (Manager)</SelectItem>
                <SelectItem value="executive">ผู้บริหาร (Executive)</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                <SelectItem value="owner">เจ้าของ (Owner)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">ผู้บริหารและผู้ดูแลระบบจะเข้าถึงได้ทุกฟังก์ชันอัตโนมัติ</p>
          </div>

          {(empRole !== "admin" && empRole !== "executive" && empRole !== "owner") && (
            <div className="space-y-3 border-t border-white/10 pt-4 mt-2">
              <Label className="text-base font-semibold">การเข้าถึงฟังก์ชัน (Feature Access)</Label>
              <p className="text-xs text-muted-foreground mb-2">เลือกเฉพาะฟังก์ชันที่ต้องการให้พนักงานคนนี้เห็นและใช้งานได้</p>
              <div className="grid gap-3 bg-slate-950/30 p-3 rounded-lg border border-white/5">
                {AVAILABLE_FEATURES.map(feature => (
                  <div key={feature.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={`edit-feat-${feature.id}`}
                      checked={allowedFeatures.includes(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                      className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <Label htmlFor={`edit-feat-${feature.id}`} className="font-normal cursor-pointer text-sm">
                      {feature.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">ยกเลิก</Button>
          <Button onClick={handleUpdate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
            บันทึกการเปลี่ยนแปลง
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}
