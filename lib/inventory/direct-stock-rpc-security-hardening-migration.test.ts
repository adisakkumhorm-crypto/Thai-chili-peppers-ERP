import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationRelativePath =
  "supabase/migrations/20261101100000_mod001_i11_direct_stock_rpc_security_hardening.sql"

const migrationPath = resolve(
  process.cwd(),
  migrationRelativePath,
)

const migrationExists = existsSync(migrationPath)

const readMigration = () =>
  readFileSync(migrationPath, "utf8")

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const squash = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "")

const exactSignatures = [
  "public.rpc_receive_stock_direct(uuid,uuid,uuid,integer,numeric,text,text,text,uuid)",
  "public.rpc_issue_stock(uuid,text,integer,text,uuid,uuid,uuid,text,uuid)",
  "public.rpc_transfer_stock(uuid,uuid,uuid,uuid,integer,text,text,uuid)",
]

const countMatches = (
  value: string,
  expression: RegExp,
) => [...value.matchAll(expression)].length

describe(
  "MOD-001 I-11 direct stock RPC security hardening migration",
  () => {
    it("migration file exists", () => {
      expect(
        migrationExists,
        `missing ${migrationRelativePath}`,
      ).toBe(true)
    })

    it("uses ALTER FUNCTION metadata changes only", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(sql).not.toMatch(
        /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i,
      )

      expect(sql).not.toMatch(
        /\bDROP\s+FUNCTION\b/i,
      )
    })

    it("targets all three exact existing RPC signatures", () => {
      if (!migrationExists) return

      const compact = squash(readMigration())

      for (const signature of exactSignatures) {
        expect(compact).toContain(
          squash(signature),
        )
      }
    })

    it("explicitly preserves SECURITY INVOKER on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\balter function\b[^;]*\bsecurity invoker\b/g,
        ),
      ).toBe(3)
    })

    it("locks search_path to public, pg_temp on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\balter function\b[^;]*\bset search_path\s*=\s*public\s*,\s*pg_temp\b/g,
        ),
      ).toBe(3)
    })

    it("sets postgres ownership on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\balter function\b[^;]*\bowner to postgres\b/g,
        ),
      ).toBe(3)
    })

    it("revokes function privileges from PUBLIC on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom public\b/g,
        ),
      ).toBe(3)
    })

    it("revokes function privileges from anon on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom anon\b/g,
        ),
      ).toBe(3)
    })

    it("grants EXECUTE to authenticated on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bgrant execute\b[^;]*\bon function\b[^;]*\bto authenticated\b/g,
        ),
      ).toBe(3)
    })

    it("grants EXECUTE to service_role on all three RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bgrant execute\b[^;]*\bon function\b[^;]*\bto service_role\b/g,
        ),
      ).toBe(3)
    })

    it("never grants EXECUTE to PUBLIC or anon", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).not.toMatch(
        /\bgrant execute\b[^;]*\bto (?:public|anon)\b/,
      )
    })

    it("contains no business-table DML", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).not.toMatch(
        /\b(?:insert into|update|delete from)\s+(?:public\.)?(?:inventory_balances|inventory_transactions|products|sales_orders|sales_order_items)\b/,
      )
    })
  },
)
