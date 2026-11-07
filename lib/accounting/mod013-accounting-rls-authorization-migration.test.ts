import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261107150000_mod013_accounting_rls_authorization.sql",
)

const sql = readFileSync(migrationPath, "utf8")

describe("MOD-013 accounting RLS authorization hardening", () => {
  it("removes the legacy org-member ALL policies", () => {
    expect(sql).toContain(
      "DROP POLICY IF EXISTS accounting_connections_rw",
    )

    expect(sql).toContain(
      "DROP POLICY IF EXISTS accounting_sync_map_rw",
    )
  })

  it("keeps organization-member SELECT access", () => {
    expect(sql).toMatch(
      /CREATE POLICY accounting_connections_select[\s\S]*?FOR SELECT[\s\S]*?private\.is_org_member\(org_id\)/,
    )

    expect(sql).toMatch(
      /CREATE POLICY accounting_sync_map_select[\s\S]*?FOR SELECT[\s\S]*?private\.is_org_member\(org_id\)/,
    )
  })

  it("requires owner or admin for accounting_connections mutations", () => {
    for (const policy of [
      "accounting_connections_insert_admin",
      "accounting_connections_update_admin",
      "accounting_connections_delete_admin",
    ]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`)
    }

    expect(sql).toMatch(
      /accounting_connections_insert_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )

    expect(sql).toMatch(
      /accounting_connections_update_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )

    expect(sql).toMatch(
      /accounting_connections_delete_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )
  })

  it("requires owner or admin for accounting_sync_map mutations", () => {
    for (const policy of [
      "accounting_sync_map_insert_admin",
      "accounting_sync_map_update_admin",
      "accounting_sync_map_delete_admin",
    ]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`)
    }

    expect(sql).toMatch(
      /accounting_sync_map_insert_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )

    expect(sql).toMatch(
      /accounting_sync_map_update_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )

    expect(sql).toMatch(
      /accounting_sync_map_delete_admin[\s\S]*?m\.user_id = auth\.uid\(\)[\s\S]*?m\.role::text IN \('owner', 'admin'\)/,
    )
  })

  it("does not grant mutation access to anon or public", () => {
    expect(sql).not.toMatch(
      /FOR (INSERT|UPDATE|DELETE)[\s\S]*?TO (anon|public)/i,
    )
  })
})
