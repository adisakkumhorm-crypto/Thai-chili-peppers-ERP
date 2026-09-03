"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Loader2, UserPlus, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { processJoinRequest } from "../actions"

type Request = {
  id: string
  userId: string
  email: string | null
  fullName: string | null
  createdAt: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  position: string | null
}

const AVAILABLE_FEATURES = [
  { id: "dashboard", label: "Dashboard (ภาพรวม)" },
  { id: "projects", label: "Projects & Deals (โครงการและการขาย)" },
  { id: "inventory", label: "Inventory (คลังสินค้า)" },
  { id: "sales", label: "Sales (ขายหน้าร้าน/ออนไลน์)" },
  { id: "hr", label: "HR & Payroll (บุคคลและเงินเดือน)" },
  { id: "finance", label: "Finance & Purchases (การเงินและจัดซื้อ)" },
  { id: "settings", label: "Settings & Team (ตั้งค่าระบบและทีม)" },
]

export function JoinRequests({ 
  requests,
  unlinkedEmployees
}: { 
  requests: Request[]
  unlinkedEmployees: Employee[]
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  const [selectedReq, setSelectedReq] = useState<Request | null>(null)
  const [actionType, setActionType] = useState<'new' | 'link'>('new')
  
  // Form state
  const [empRole, setEmpRole] = useState<'staff' | 'foreman' | 'manager' | 'executive' | 'admin'>('staff')
  const [empCode, setEmpCode] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [position, setPosition] = useState("")
  const [linkEmpId, setLinkEmpId] = useState("")
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>([])
  
  // To prevent Next.js router.refresh() from causing DOM mismatch with Radix UI Dialog Portal,
  // we use a separate open state for the dialog.
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleReject = async (req: Request) => {
    setLoadingId(req.id)
    const res = await processJoinRequest({
      requestId: req.id,
      action: 'reject'
    })
    setLoadingId(null)
    if (res.error) {
      toast.error("Error", { description: res.error })
    } else {
      toast.success("ปฏิเสธคำขอแล้ว")
      router.refresh()
    }
  }

  const openApproveModal = (req: Request) => {
    setSelectedReq(req)
    if (req.fullName) {
      const parts = req.fullName.split(' ')
      setFirstName(parts[0] || "")
      setLastName(parts.slice(1).join(' ') || "")
    } else {
      setFirstName("")
      setLastName("")
    }
    const randomCode = "EMP" + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    setEmpCode(randomCode)
    setPosition("")
    setEmpRole("staff")
    setAllowedFeatures(["dashboard"]) // Default
    setIsDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedReq) return
    setLoadingId(selectedReq.id)
    
    // Auto grant all features for admin/executive
    const finalFeatures = (empRole === "admin" || empRole === "executive") 
      ? AVAILABLE_FEATURES.map(f => f.id) 
      : allowedFeatures

    const res = await processJoinRequest({
      requestId: selectedReq.id,
      action: 'approve',
      employeeOption: actionType,
      employeeId: linkEmpId,
      employeeRole: empRole,
      employeeCode: empCode,
      firstName,
      lastName,
      position,
      allowedFeatures: finalFeatures
    })
    
    setLoadingId(null)
    
    if (res.error) {
      toast.error("Error", { description: res.error })
    } else {
      setIsDialogOpen(false)
      // Small delay before clearing selectedReq and refreshing to let Dialog closing animation finish
      setTimeout(() => {
        setSelectedReq(null)
        toast.success("อนุมัติผู้ใช้งานสำเร็จ!")
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

  if (requests.length === 0) return null

  return (
    <div className="space-y-4 mb-8">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
        </span>
        คำขอเข้าใช้งานรออนุมัติ ({requests.length})
      </h3>
      
      <ul className="divide-y rounded-md border bg-card">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs bg-yellow-500/20 text-yellow-600">
                  {req.fullName ? req.fullName[0].toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{req.fullName || "ไม่ระบุชื่อ"}</p>
                <p className="text-xs text-muted-foreground">{req.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleReject(req)}
                disabled={loadingId === req.id}
              >
                {loadingId === req.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              </Button>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => openApproveModal(req)}
                disabled={loadingId === req.id}
              >
                {loadingId === req.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 mr-1" />}
                อนุมัติ
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* Do not conditionally render the Dialog wrapper itself, control it via the 'open' prop */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          {selectedReq && (
            <>
              <DialogHeader>
                <DialogTitle>อนุมัติผู้ใช้งาน</DialogTitle>
                <DialogDescription>
                  {selectedReq.email} จะสามารถเข้าใช้งานระบบได้ โปรดระบุข้อมูลสิทธิ์พนักงาน
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="flex gap-4 border-b pb-4">
                  <Button 
                    type="button" 
                    variant={actionType === 'new' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => setActionType('new')}
                  >
                    <UserPlus className="size-4 mr-2" /> สร้างใหม่
                  </Button>
                  <Button 
                    type="button" 
                    variant={actionType === 'link' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => setActionType('link')}
                  >
                    <LinkIcon className="size-4 mr-2" /> ผูกประวัติเดิม
                  </Button>
                </div>

                {actionType === 'new' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ชื่อ</Label>
                        <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>นามสกุล</Label>
                        <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>รหัสพนักงาน</Label>
                        <Input value={empCode} onChange={e => setEmpCode(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>ตำแหน่ง (Position)</Label>
                        <Input value={position} onChange={e => setPosition(e.target.value)} placeholder="เช่น บัญชี, วิศวกร" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>เลือกพนักงานที่ต้องการผูก</Label>
                    <Select value={linkEmpId} onValueChange={(v: any) => setLinkEmpId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกพนักงาน..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unlinkedEmployees.length === 0 ? (
                          <SelectItem value="none" disabled>ไม่มีพนักงานที่ยังไม่ถูกผูก</SelectItem>
                        ) : (
                          unlinkedEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name} {emp.position ? `(${emp.position})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <Label className="text-base font-semibold">ระดับสิทธิ์ของพนักงาน (Role Level)</Label>
                  <Select value={empRole} onValueChange={(v: any) => setEmpRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">พนักงานทั่วไป (Staff)</SelectItem>
                      <SelectItem value="foreman">หัวหน้างาน (Foreman)</SelectItem>
                      <SelectItem value="manager">ผู้จัดการ (Manager)</SelectItem>
                      <SelectItem value="executive">ผู้บริหาร (Executive)</SelectItem>
                      <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">ผู้บริหารและผู้ดูแลระบบจะเข้าถึงได้ทุกฟังก์ชันอัตโนมัติ</p>
                </div>

                {(empRole !== "admin" && empRole !== "executive") && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">การเข้าถึงฟังก์ชัน (Feature Access)</Label>
                    <p className="text-xs text-muted-foreground mb-2">เลือกเฉพาะฟังก์ชันที่ต้องการให้พนักงานคนนี้เห็นและใช้งานได้</p>
                    <div className="grid gap-3">
                      {AVAILABLE_FEATURES.map(feature => (
                        <div key={feature.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`feat-${feature.id}`}
                            checked={allowedFeatures.includes(feature.id)}
                            onCheckedChange={() => toggleFeature(feature.id)}
                          />
                          <Label htmlFor={`feat-${feature.id}`} className="font-normal cursor-pointer">
                            {feature.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleApprove} disabled={(actionType === 'link' && !linkEmpId) || !!loadingId}>
                  {loadingId ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  ยืนยันการอนุมัติ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
