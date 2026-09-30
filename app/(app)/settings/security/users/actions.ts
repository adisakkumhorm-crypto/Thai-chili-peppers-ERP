"use server"

import { revalidatePath } from "next/cache"

import { requireOrgContext } from "@/lib/auth"
import { writeAudit } from "@/lib/audit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function permanentDeleteLogin(input: {
  userId: string
  orgId: string
}) {
  const ctx = await requireOrgContext()

  if (ctx.role !== "owner") {
    return {
      error: "เฉพาะ Owner เท่านั้นที่สามารถลบ Login ถาวรได้",
    }
  }

  if (input.orgId !== ctx.orgId) {
    return {
      error: "องค์กรเป้าหมายไม่ตรงกับองค์กรปัจจุบัน",
    }
  }

  if (input.userId === ctx.userId) {
    return {
      error: "ไม่สามารถลบบัญชี Login ที่กำลังใช้งานอยู่ได้",
    }
  }

  /*
   * Authorization must use the session-bound client.
   * The RPC uses auth.uid() to verify the real signed-in Owner,
   * Removed Candidate provenance, and global reference safety.
   */
  const supabase = await createClient()

  const { error: gateError } = await (supabase as any).rpc(
    "assert_permanent_login_delete_allowed",
    {
      p_target_user_id: input.userId,
      p_org_id: input.orgId,
    }
  )

  if (gateError) {
    const message = gateError.message || ""

    if (message.includes("SELF_DELETE_BLOCKED")) {
      return {
        error: "ไม่สามารถลบบัญชี Login ที่กำลังใช้งานอยู่ได้",
      }
    }

    if (message.includes("OWNER_REQUIRED")) {
      return {
        error: "เฉพาะ Owner เท่านั้นที่สามารถลบ Login ถาวรได้",
      }
    }

    if (message.includes("REMOVED_CANDIDATE_REQUIRED")) {
      return {
        error:
          "บัญชีนี้ไม่ได้อยู่ในรายการ Removed Login Candidate ขององค์กรปัจจุบัน",
      }
    }

    if (message.includes("AUTH_USER_NOT_FOUND")) {
      return {
        error: "ไม่พบบัญชี Login นี้แล้ว",
      }
    }

    if (message.includes("AUTH_USER_STILL_REFERENCED")) {
      return {
        error:
          "บัญชีนี้ยังถูกใช้งานหรือมีประวัติอ้างอิงอยู่ในระบบ จึงไม่สามารถลบถาวรได้",
      }
    }

    return {
      error: "ไม่สามารถอนุญาตการลบ Login ถาวรได้",
    }
  }

  const adminClient = createAdminClient()

  /*
   * Fetch email before deletion so the audit record can preserve
   * a human-readable identity after auth.users is gone.
   */
  const { data: targetResult, error: targetError } =
    await adminClient.auth.admin.getUserById(input.userId)

  if (targetError || !targetResult.user) {
    return {
      error: "ไม่พบบัญชี Login นี้แล้ว",
    }
  }

  const targetEmail =
    targetResult.user.email ?? "Unknown"

  /*
   * Hard delete.
   *
   * The DB BEFORE DELETE trigger independently runs the global
   * reference guard again. This closes the race window between
   * authorization and the actual Auth deletion.
   */
  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(
      input.userId,
      false
    )

  if (deleteError) {
    const message = deleteError.message || ""

    if (
      message.includes(
        "AUTH_USER_DELETE_BLOCKED_REFERENCES"
      )
    ) {
      return {
        error:
          "บัญชีนี้มีข้อมูลอ้างอิงใหม่เกิดขึ้น จึงถูกระบบป้องกันไม่ให้ลบถาวร",
      }
    }

    return {
      error:
        "การลบ Login ถาวรไม่สำเร็จ กรุณาตรวจสอบสถานะบัญชีอีกครั้ง",
    }
  }

  /*
   * Best-effort audit after successful deletion.
   * The original REMOVE_MEMBER tombstone also remains as provenance.
   */
  await writeAudit(ctx, {
    entity: "login",
    entityId: input.userId,
    action: "PERMANENT_DELETE_LOGIN",
    summary: `Permanently deleted Login ${targetEmail}`,
    meta: {
      target_user_id: input.userId,
      target_email: targetEmail,
    },
  })

  revalidatePath("/settings/security/users")

  return {
    success: true,
  }
}
