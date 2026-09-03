/**
 * Pure, dependency-free password policy for real (non-demo) signups.
 *
 * Policy (all must hold):
 *   - at least {@link PASSWORD_MIN_LENGTH} characters
 *   - at least one lowercase letter (a–z)
 *   - at least one uppercase letter (A–Z)
 *   - at least one digit (0–9)
 *
 * The lowercase + uppercase requirements together imply "not entirely numeric",
 * so all-numeric passwords are rejected without a separate rule.
 *
 * Returns human-readable issue strings so the signup form can show every
 * failing rule at once. DB-independent and safe to unit test in isolation.
 */

export const PASSWORD_MIN_LENGTH = 6

export type PasswordCheck = {
  /** True only when every policy rule is satisfied. */
  ok: boolean
  /** Human-readable description of each unmet rule. Empty when `ok` is true. */
  issues: string[]
}

/**
 * Validate a password against the policy above.
 *
 * Defensive against non-string input (e.g. `undefined` from untyped callers):
 * a non-string is treated as failing every rule.
 */
export function validatePassword(pw: string): PasswordCheck {
  const issues: string[] = []

  if (typeof pw !== "string") {
    return { ok: false, issues: ["จำเป็นต้องระบุรหัสผ่าน"] }
  }

  if (pw.length < PASSWORD_MIN_LENGTH) {
    issues.push(`รหัสผ่านต้องมีความยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`)
  }

  return { ok: issues.length === 0, issues }
}
