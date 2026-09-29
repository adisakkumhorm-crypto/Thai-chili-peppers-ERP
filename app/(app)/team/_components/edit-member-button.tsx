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
import { updateMemberAccess } from "../actions"

import { NAV_ITEMS } from "@/components/nav"

type MembershipRole = "owner" | "admin" | "member"
type EmployeeRole = "staff" | "foreman" | "manager" | "executive" | "admin"

const AVAILABLE_FEATURES = NAV_ITEMS.filter((item) => !item.isBasic).map(
  (item) => ({
    id: item.href,
    label: item.title,
  })
)

function sameFeatureSet(a: string[], b: string[]) {
  return (
    a.length === b.length &&
    a.every((feature) => b.includes(feature))
  )
}

export function EditMemberButton({
  userId,
  orgId,
  memberName,
  actorRole,
  currentMembershipRole,
  currentEmployeeRole,
  currentFeatures,
}: {
  userId: string
  orgId: string
  memberName: string
  actorRole: MembershipRole
  currentMembershipRole: MembershipRole
  currentEmployeeRole: EmployeeRole | null
  currentFeatures: string[]
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const [membershipRole, setMembershipRole] =
    useState<MembershipRole>(currentMembershipRole)

  const [employeeRole, setEmployeeRole] =
    useState<EmployeeRole | null>(currentEmployeeRole)

  const [allowedFeatures, setAllowedFeatures] =
    useState<string[]>(currentFeatures)

  const hasEmployeeRecord = currentEmployeeRole !== null

  const handleUpdate = async () => {
    setLoading(true)

    const finalFeatures =
      hasEmployeeRecord &&
      (employeeRole === "admin" || employeeRole === "executive")
        ? AVAILABLE_FEATURES.map((feature) => feature.id)
        : allowedFeatures

    const nextMembershipRole =
      membershipRole === currentMembershipRole
        ? null
        : membershipRole

    const nextEmployeeRole =
      hasEmployeeRecord && employeeRole !== currentEmployeeRole
        ? employeeRole
        : null

    const nextFeatures =
      hasEmployeeRecord &&
      !sameFeatureSet(finalFeatures, currentFeatures)
        ? finalFeatures
        : null

    const res = await updateMemberAccess({
      userId,
      orgId,
      membershipRole: nextMembershipRole,
      employeeRole: nextEmployeeRole,
      allowedFeatures: nextFeatures,
    })

    setLoading(false)

    if (res?.error) {
      toast.error("เกิดข้อผิดพลาด", {
        description: res.error,
      })
      return
    }

    setOpen(false)

    setTimeout(() => {
      toast.success(`อัปเดตสิทธิ์ของ ${memberName} เรียบร้อยแล้ว`)
      router.refresh()
    }, 300)
  }

  const toggleFeature = (featureId: string) => {
    setAllowedFeatures((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId]
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-full h-8 w-8 ml-1 transition-colors"
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] bg-slate-900 border border-white/10 text-white shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>แก้ไขสิทธิ์สมาชิก</DialogTitle>
            <DialogDescription className="text-slate-400">
              แยกสิทธิ์ระดับองค์กรและตำแหน่งพนักงานของ{" "}
              <b className="text-white">{memberName}</b>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                สิทธิ์ระดับองค์กร (Organization Access)
              </Label>

              <Select
                value={membershipRole}
                onValueChange={(value) =>
                  setMembershipRole(value as MembershipRole)
                }
              >
                <SelectTrigger className="bg-slate-950/50 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="member">
                    สมาชิก (Member)
                  </SelectItem>

                  <SelectItem value="admin">
                    ผู้ดูแลระบบ (Admin)
                  </SelectItem>

                  {actorRole === "owner" && (
                    <SelectItem value="owner">
                      เจ้าของระบบ (Owner)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Owner / Admin / Member ใช้สำหรับสิทธิ์ระดับองค์กรเท่านั้น
              </p>
            </div>

            {hasEmployeeRecord && employeeRole ? (
              <>
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <Label className="text-base font-semibold">
                    ระดับพนักงาน (Employee Role)
                  </Label>

                  <Select
                    value={employeeRole}
                    onValueChange={(value) =>
                      setEmployeeRole(value as EmployeeRole)
                    }
                  >
                    <SelectTrigger className="bg-slate-950/50 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="staff">
                        พนักงานทั่วไป (Staff)
                      </SelectItem>
                      <SelectItem value="foreman">
                        หัวหน้างาน (Foreman)
                      </SelectItem>
                      <SelectItem value="manager">
                        ผู้จัดการ (Manager)
                      </SelectItem>
                      <SelectItem value="executive">
                        ผู้บริหาร (Executive)
                      </SelectItem>
                      <SelectItem value="admin">
                        ผู้ดูแลระบบฝ่ายงาน (Admin)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-muted-foreground">
                    Employee Role ไม่เปลี่ยน Membership Role
                  </p>
                </div>

                {employeeRole !== "admin" &&
                  employeeRole !== "executive" && (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <Label className="text-base font-semibold">
                        การเข้าถึงฟังก์ชัน (Feature Access)
                      </Label>

                      <p className="text-xs text-muted-foreground">
                        เลือกเฉพาะฟังก์ชันที่พนักงานคนนี้สามารถใช้งานได้
                      </p>

                      <div className="grid gap-3 bg-slate-950/30 p-3 rounded-lg border border-white/5">
                        {AVAILABLE_FEATURES.map((feature) => (
                          <div
                            key={feature.id}
                            className="flex items-center space-x-3"
                          >
                            <Checkbox
                              id={`edit-feat-${feature.id}`}
                              checked={allowedFeatures.includes(feature.id)}
                              onCheckedChange={() =>
                                toggleFeature(feature.id)
                              }
                              className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />

                            <Label
                              htmlFor={`edit-feat-${feature.id}`}
                              className="font-normal cursor-pointer text-sm"
                            >
                              {feature.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {(employeeRole === "admin" ||
                  employeeRole === "executive") && (
                  <p className="text-xs text-muted-foreground border-t border-white/10 pt-4">
                    Role นี้จะได้รับ Feature Access ที่มีอยู่ทั้งหมดอัตโนมัติ
                  </p>
                )}
              </>
            ) : (
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-amber-300">
                  บัญชีนี้ยังไม่มี Employee Record
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  สามารถแก้ Membership Role ได้ แต่ระบบจะไม่สร้าง Employee
                  Record ให้อัตโนมัติ
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
            >
              ยกเลิก
            </Button>

            <Button
              onClick={handleUpdate}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Check className="size-4 mr-2" />
              )}
              บันทึกการเปลี่ยนแปลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
