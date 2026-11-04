import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationRelativePath =
  "supabase/migrations/20261104100000_mod008_direct_stock_actor_authorization_hardening.sql"

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

const countMatches = (
  value: string,
  expression: RegExp,
) => [...value.matchAll(expression)].length

const exactSignatures = [
  "public.rpc_receive_po_items(uuid,uuid,uuid,uuid,jsonb,text)",
  "public.rpc_adjust_stock(uuid,uuid,uuid,integer,numeric,text,text,text,uuid)",
  "public.rpc_issue_stock(uuid,text,integer,text,uuid,uuid,uuid,text,uuid)",
  "public.rpc_receive_stock_direct(uuid,uuid,uuid,integer,numeric,text,text,text,uuid)",
  "public.rpc_transfer_stock(uuid,uuid,uuid,uuid,integer,text,text,uuid)",
]

describe(
  "MOD-008 revised actor authorization hardening migration",
  () => {
    it("migration file exists", () => {
      expect(
        migrationExists,
        `missing ${migrationRelativePath}`,
      ).toBe(true)
    })

    it("targets exactly the five locked functions", () => {
      if (!migrationExists) return

      const sql = readMigration()
      const compact = squash(sql)

      for (const signature of exactSignatures) {
        expect(compact).toContain(
          squash(signature),
        )
      }

      expect(
        countMatches(
          normalize(sql),
          /\bcreate or replace function public\.rpc_/g,
        ),
      ).toBe(5)

      expect(
        normalize(sql),
      ).not.toMatch(
        /\bcreate or replace function public\.rpc_(?:ship_sales_order|reserve_so_item|delete_so_item|cancel_sales_order_reservation)\b/,
      )
    })

    it("preserves SECURITY INVOKER for all five targets", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\balter function\b[^;]*\bsecurity invoker\b/g,
        ),
      ).toBe(5)

      expect(sql).not.toMatch(
        /\bsecurity definer\b/,
      )
    })

    it("contains four direct-stock authorization guards", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(
        sql.match(
          /MOD-008 BEGIN DIRECT STOCK AUTHORIZATION GUARD/g,
        )?.length,
      ).toBe(4)

      expect(
        sql.match(
          /MOD-008 END DIRECT STOCK AUTHORIZATION GUARD/g,
        )?.length,
      ).toBe(4)
    })

    it("preserves the MOD-007 PO receive authorization guard", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(
        sql.match(
          /MOD-007 BEGIN RECEIVE AUTHORIZATION GUARD/g,
        )?.length,
      ).toBe(1)

      expect(
        sql.match(
          /MOD-007 END RECEIVE AUTHORIZATION GUARD/g,
        )?.length,
      ).toBe(1)

      for (const marker of [
        "PO_RECEIVE_AUTH_REQUIRED",
        "PO_RECEIVE_ACTOR_MISMATCH",
        "PO_RECEIVE_ORG_FORBIDDEN",
        "PO_RECEIVE_CALLER_FORBIDDEN",
      ]) {
        expect(sql).toContain(marker)
      }
    })

    it("never invokes private.is_org_member in the revised migration", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(sql).not.toMatch(
        /private\.is_org_member/i,
      )
    })

    it("never grants or alters access to schema private", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).not.toMatch(
        /\bgrant\s+usage\s+on\s+schema\s+private\b/,
      )

      expect(sql).not.toMatch(
        /\balter\s+schema\s+private\b/,
      )

      expect(sql).not.toMatch(
        /\bgrant\b[^;]*\bon\s+schema\s+private\b/,
      )
    })

    it("uses the inline self-membership predicate exactly five times", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /from public\.memberships m where m\.org_id = p_org_id and m\.user_id = auth\.uid\(\)/g,
        ),
      ).toBe(5)
    })

    it("binds authenticated direct-stock actors to auth.uid", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /if current_user = 'authenticated' then/g,
        ),
      ).toBe(5)

      expect(
        countMatches(
          sql,
          /if p_user_id is distinct from auth\.uid\(\) then/g,
        ),
      ).toBe(5)

      for (const marker of [
        "DIRECT_STOCK_AUTH_REQUIRED",
        "DIRECT_STOCK_ACTOR_REQUIRED",
        "DIRECT_STOCK_ACTOR_MISMATCH",
        "DIRECT_STOCK_ORG_FORBIDDEN",
        "DIRECT_STOCK_CALLER_FORBIDDEN",
      ]) {
        expect(
          sql.match(
            new RegExp(marker.toLowerCase(), "g"),
          )?.length,
        ).toBe(4)
      }
    })

    it("preserves trusted service_role branches on all five targets", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /elsif current_user = 'service_role' then/g,
        ),
      ).toBe(5)
    })

    it("keeps PUBLIC and anon blocked while authenticated and service_role retain EXECUTE", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom public\b/g,
        ),
      ).toBe(5)

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom anon\b/g,
        ),
      ).toBe(5)

      expect(
        countMatches(
          sql,
          /\bgrant execute\b[^;]*\bon function\b[^;]*\bto authenticated, service_role\b/g,
        ),
      ).toBe(5)
    })

    it("does not change RLS policies, memberships schema, or tables", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).not.toMatch(
        /\b(?:alter|create|drop)\s+policy\b/,
      )

      expect(sql).not.toMatch(
        /\balter\s+table\b/,
      )

      expect(sql).not.toMatch(
        /\bcreate\s+table\b/,
      )

      expect(sql).not.toMatch(
        /\bdrop\s+table\b/,
      )

      expect(sql).not.toMatch(
        /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(?:is_org_member|membership)/,
      )
    })

    it("retains PO receive and direct-stock business-contract markers", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      for (const marker of [
        "purchase_order_items",
        "inventory_balances",
        "inventory_transactions",
        "products",
        "received_quantity",
        "idempotency_key",
        "created_by",
        "p_user_id",
        "p_org_id",
      ]) {
        expect(sql).toContain(marker)
      }
    })

    it("contains exactly one outer migration transaction wrapper", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(
        sql.match(
          /^BEGIN;$/gm,
        )?.length,
      ).toBe(1)

      expect(
        sql.match(
          /^COMMIT;$/gm,
        )?.length,
      ).toBe(1)
    })
  },
)
