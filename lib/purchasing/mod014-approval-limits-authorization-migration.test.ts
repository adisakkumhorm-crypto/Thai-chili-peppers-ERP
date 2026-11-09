import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261109100000_mod014_approval_limits_authorization.sql",
  ),
  "utf8",
)

describe("MOD-014 approval_limits authorization boundary", () => {
  it("removes the legacy org-member ALL policy", () => {
    expect(migration).toContain(
      "DROP POLICY IF EXISTS approval_limits_rw",
    )
    expect(migration).not.toContain(
      "CREATE POLICY approval_limits_rw",
    )
  })

  it("preserves org-member read access", () => {
    expect(migration).toContain(
      "CREATE POLICY approval_limits_select",
    )
    expect(migration).toContain(
      "FOR SELECT",
    )
    expect(migration).toContain(
      "private.is_org_member(org_id)",
    )
  })

  it("restricts inserts to owner/admin actors", () => {
    expect(migration).toContain(
      "CREATE POLICY approval_limits_insert_admin",
    )
    expect(migration).toContain(
      "m.user_id = auth.uid()",
    )
    expect(migration).toContain(
      "m.role::text IN ('owner', 'admin')",
    )
  })

  it("restricts updates and deletes to owner/admin actors", () => {
    expect(migration).toContain(
      "CREATE POLICY approval_limits_update_admin",
    )
    expect(migration).toContain(
      "CREATE POLICY approval_limits_delete_admin",
    )

    const ownerAdminChecks =
      migration.match(/m\.role::text IN \('owner', 'admin'\)/g) ?? []

    expect(ownerAdminChecks.length).toBeGreaterThanOrEqual(4)
  })

  it("does not grant mutation policies to anon or public", () => {
    expect(migration).not.toMatch(
      /FOR (INSERT|UPDATE|DELETE)[\s\S]*?TO (anon|public)/,
    )
  })

  it("does not alter role_name approval semantics", () => {
    expect(migration).not.toMatch(
      /\brole_name\b\s*(=|IN|IS)/,
    )
  })
})
