import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261103110000_mod004_setup_default_accounts_security_hardening.sql",
)

const sql = readFileSync(migrationPath, "utf8")

describe("MOD-004 setup_default_accounts security hardening migration", () => {
  it("replaces exactly one setup_default_accounts function", () => {
    const matches =
      sql.match(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.setup_default_accounts\s*\(\s*\)/gi,
      ) ?? []

    expect(matches).toHaveLength(1)
  })

  it("preserves trigger return type and SECURITY DEFINER", () => {
    expect(sql).toMatch(/RETURNS\s+trigger/i)
    expect(sql).toMatch(/LANGUAGE\s+plpgsql/i)
    expect(sql).toMatch(/SECURITY\s+DEFINER/i)
  })

  it("locks the function search_path to empty", () => {
    expect(sql).toMatch(/SET\s+search_path\s+TO\s+''/i)
  })

  it("schema-qualifies the accounts write target", () => {
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.accounts\s*\(/i)
    expect(sql).not.toMatch(/INSERT\s+INTO\s+accounts\s*\(/i)
  })

  it("preserves the exact 15 default account codes", () => {
    const expectedCodes = [
      "1110",
      "1120",
      "1200",
      "2100",
      "2150",
      "3100",
      "4100",
      "4200",
      "5100",
      "5200",
      "5300",
      "5400",
      "5500",
      "5600",
      "5900",
    ]

    const foundCodes = Array.from(
      sql.matchAll(/\(NEW\.id,\s*'(\d{4})'/g),
      (match) => match[1],
    )

    expect(foundCodes).toEqual(expectedCodes)
  })

  it("preserves ON CONFLICT DO NOTHING and RETURN NEW", () => {
    expect(sql).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i)
    expect(sql).toMatch(/RETURN\s+NEW\s*;/i)
  })

  it("preserves postgres as function owner", () => {
    expect(sql).toMatch(
      /ALTER\s+FUNCTION\s+public\.setup_default_accounts\s*\(\s*\)\s+OWNER\s+TO\s+postgres\s*;/i,
    )
  })

  it.each([
    "PUBLIC",
    "anon",
    "authenticated",
    "service_role",
  ])("revokes direct EXECUTE surface from %s", (role) => {
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    expect(sql).toMatch(
      new RegExp(
        `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.setup_default_accounts\\s*\\(\\s*\\)\\s+FROM\\s+${escapedRole}\\s*;`,
        "i",
      ),
    )
  })

  it("does not grant direct function execution", () => {
    expect(sql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.setup_default_accounts/i,
    )
  })

  it("does not modify the trigger binding or tables", () => {
    expect(sql).not.toMatch(/\bCREATE\s+TRIGGER\b/i)
    expect(sql).not.toMatch(/\bDROP\s+TRIGGER\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TRIGGER\b/i)

    expect(sql).not.toMatch(/\bCREATE\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i)
  })

  it("does not modify RLS policies", () => {
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bALTER\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bDROP\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i)
    expect(sql).not.toMatch(/\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i)
  })

  it("does not touch handle_new_user", () => {
    expect(sql).not.toMatch(/handle_new_user/i)
  })
})
