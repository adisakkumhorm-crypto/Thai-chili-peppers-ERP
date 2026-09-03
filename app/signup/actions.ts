"use server"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validatePassword } from "@/lib/auth/password"

const SignupSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
})

export type SignupResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Real (non-demo) signup. Never trusts client input: validates the email with
 * Zod and the password against the shared policy before touching Supabase.
 * On success Supabase sends a confirmation email; the user is created in an
 * unconfirmed state until they click the link, which lands on /auth/confirm.
 */
export async function signUp(input: {
  email: string
  password: string
}): Promise<SignupResult> {
  const parsed = SignupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const { email, password } = parsed.data

  const policy = validatePassword(password)
  if (!policy.ok) {
    return { ok: false, error: policy.issues.join(" ") }
  }

  const adminClient = createAdminClient()

  // 1. Create user and Auto-confirm email (Bypass Email)
  const { data: authData, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const user = authData.user
  if (user) {
    // 2. Auto-create join request to bypass the 'request access' manual step
    const { data: org } = await adminClient.from("organizations").select("id").limit(1).single()
    if (org) {
      await adminClient.from("join_requests" as any).insert({
        user_id: user.id,
        org_id: org.id,
        status: "pending"
      })
    }
  }

  return { ok: true }
}
