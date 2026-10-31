import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261031103000_mod001_i5a_adjust_rpc_acl_hardening.sql"
)

const sql = readFileSync(migrationPath, "utf8")
const compact = sql.replace(/\s+/g, " ")

describe("MOD-001 I-5A adjust RPC ACL hardening migration", () => {
  it("does not recreate or alter the adjust RPC implementation", () => {
    expect(compact).not.toContain(
      "CREATE OR REPLACE FUNCTION public.rpc_adjust_stock"
    )
    expect(compact).not.toContain("CREATE FUNCTION public.rpc_adjust_stock")
    expect(compact).not.toContain("DROP FUNCTION")
  })

  it("revokes execution from both PUBLIC and direct anon", () => {
    expect(compact).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_adjust_stock\(\s*UUID,\s*UUID,\s*UUID,\s*INTEGER,\s*NUMERIC,\s*TEXT,\s*TEXT,\s*TEXT,\s*UUID\s*\) FROM PUBLIC, anon;/
    )
  })

  it("grants execution only to authenticated and service_role", () => {
    expect(compact).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_adjust_stock\(\s*UUID,\s*UUID,\s*UUID,\s*INTEGER,\s*NUMERIC,\s*TEXT,\s*TEXT,\s*TEXT,\s*UUID\s*\) TO authenticated, service_role;/
    )
    expect(compact).not.toMatch(/\bTO anon\b/)
  })

  it("keeps the exact nine-argument function signature", () => {
    const signature =
      /public\.rpc_adjust_stock\(\s*UUID,\s*UUID,\s*UUID,\s*INTEGER,\s*NUMERIC,\s*TEXT,\s*TEXT,\s*TEXT,\s*UUID\s*\)/g

    expect(sql.match(signature)?.length).toBe(3)
  })
})
