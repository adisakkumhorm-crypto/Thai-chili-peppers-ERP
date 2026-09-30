"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { permanentDeleteLogin } from "../actions"

export function PermanentDeleteLoginButton({
  userId,
  orgId,
  email,
}: {
  userId: string
  orgId: string
  email: string
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(
    null
  )

  const [pending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)

    startTransition(async () => {
      const result = await permanentDeleteLogin({
        userId,
        orgId,
      })

      if (result?.error) {
        setError(result.error)
        return
      }

      setOpen(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return

        setOpen(nextOpen)

        if (nextOpen) {
          setError(null)
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
          />
        }
      >
        <Trash2 />
        Permanent Delete
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ลบ Login ถาวร?
          </AlertDialogTitle>

          <AlertDialogDescription>
            ระบบจะลบบัญชี Login
            {" "}
            <strong>{email}</strong>
            {" "}
            ออกจาก Auth ถาวร
            การดำเนินการนี้ไม่สามารถย้อนกลับได้
            และระบบจะตรวจสอบ Membership,
            Employee และประวัติทางธุรกิจทั้งหมดอีกครั้งก่อนลบ
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            ยกเลิก
          </AlertDialogCancel>

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending
              ? "กำลังตรวจสอบ..."
              : "ยืนยันลบถาวร"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
