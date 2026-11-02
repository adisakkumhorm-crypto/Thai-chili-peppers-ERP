import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationRelativePath =
  "supabase/migrations/20261102100000_mod002_finance_rpc_security_hardening.sql"

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
  "public.create_automated_journal_entry(uuid,public.journal_entry_source,uuid,text,jsonb)",
  "public.rpc_create_cost(uuid,uuid,public.cost_category,bigint,bigint,bigint,bigint,uuid,uuid,date,text,uuid,text,uuid,uuid)",
  "public.rpc_create_invoice(uuid,uuid,uuid,text,public.invoice_status,bigint,bigint,bigint,bigint,boolean,uuid,date,date,uuid,uuid,public.recurring_interval,text)",
  "public.rpc_record_payment(uuid,uuid,uuid,bigint,public.payment_method,timestamp with time zone,text)",
]

describe(
  "MOD-002 finance privileged RPC security hardening migration",
  () => {
    it("migration file exists", () => {
      expect(
        migrationExists,
        `missing ${migrationRelativePath}`,
      ).toBe(true)
    })

    it("does not alter finance table structure", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).not.toMatch(/\bdrop\s+function\b/)
      expect(sql).not.toMatch(/\bcreate\s+table\b/)
      expect(sql).not.toMatch(/\balter\s+table\b/)
      expect(sql).not.toMatch(/\bdrop\s+table\b/)
      expect(sql).not.toMatch(/\btruncate\b/)
      expect(sql).not.toMatch(
        /\bcreate\s+(?:unique\s+)?index\b/,
      )
    })

    it("replaces exactly four intended RPC bodies", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bcreate or replace function public\.(?:create_automated_journal_entry|rpc_create_cost|rpc_create_invoice|rpc_record_payment)\b/g,
        ),
      ).toBe(4)
    })

    it("contains all exact existing identity signatures", () => {
      if (!migrationExists) return

      const compact = squash(readMigration())

      for (const signature of exactSignatures) {
        expect(compact).toContain(
          squash(signature),
        )
      }
    })

    it("preserves default arguments", () => {
      if (!migrationExists) return

      const compact = squash(readMigration())

      expect(compact).toContain(
        squash(
          "p_vat_rate_id uuid DEFAULT NULL::uuid, " +
          "p_wht_rate_id uuid DEFAULT NULL::uuid, " +
          "p_incurred_on date DEFAULT NULL::date, " +
          "p_vendor text DEFAULT NULL::text, " +
          "p_project_id uuid DEFAULT NULL::uuid, " +
          "p_notes text DEFAULT NULL::text, " +
          "p_po_id uuid DEFAULT NULL::uuid, " +
          "p_supplier_id uuid DEFAULT NULL::uuid",
        ),
      )

      expect(compact).toContain(
        squash(
          "p_project_id uuid DEFAULT NULL::uuid, " +
          "p_issue_date date DEFAULT NULL::date, " +
          "p_due_date date DEFAULT NULL::date, " +
          "p_vat_rate_id uuid DEFAULT NULL::uuid, " +
          "p_wht_rate_id uuid DEFAULT NULL::uuid, " +
          "p_recurring_interval public.recurring_interval DEFAULT NULL::public.recurring_interval, " +
          "p_notes text DEFAULT NULL::text",
        ),
      )

      expect(compact).toContain(
        squash(
          "p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, " +
          "p_notes text DEFAULT NULL::text",
        ),
      )
    })

    it("keeps SECURITY DEFINER on exactly four RPC definitions", () => {
      if (!migrationExists) return

      const sql = readMigration()

      expect(
        countMatches(
          sql,
          /^\s*SECURITY\s+DEFINER\s*$/gim,
        ),
      ).toBe(4)
    })

    it("locks search_path on all four RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bset search_path\s*=\s*public\s*,\s*pg_temp\b/g,
        ),
      ).toBe(4)
    })

    it("requires org membership for non-service callers", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /coalesce\(auth\.role\(\), ''\) <> 'service_role' and not private\.is_org_member\(p_org_id\)/g,
        ),
      ).toBe(4)

      expect(
        countMatches(
          sql,
          /finance_org_forbidden/g,
        ),
      ).toBe(4)
    })

    it("validates journal account tenant ownership", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).toContain(
        "finance_account_org_mismatch",
      )
      expect(sql).toContain(
        "a.org_id = p_org_id",
      )
    })

    it("validates invoice foreign UUID tenant ownership", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).toContain(
        "finance_client_org_mismatch",
      )
      expect(sql).toContain(
        "finance_project_org_mismatch",
      )
      expect(sql).toContain(
        "finance_vat_rate_org_mismatch",
      )
      expect(sql).toContain(
        "finance_wht_rate_org_mismatch",
      )
    })

    it("validates cost foreign UUID tenant ownership", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).toContain(
        "finance_supplier_org_mismatch",
      )
      expect(sql).toContain(
        "finance_po_org_mismatch",
      )
    })

    it("keeps payment invoice lookup org scoped", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(sql).toMatch(
        /from public\.invoices where id = p_invoice_id and org_id = p_org_id/,
      )

      expect(sql).toContain(
        "raise exception 'invoice not found'",
      )
    })

    it("preserves three nested journal calls", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bperform public\.create_automated_journal_entry\(/g,
        ),
      ).toBe(3)

      expect(sql).toContain(
        "'manual'::public.journal_entry_source",
      )
      expect(sql).toContain(
        "'invoice'::public.journal_entry_source",
      )
      expect(sql).toContain(
        "'payment'::public.journal_entry_source",
      )
    })

    it("preserves draft-lines-posted journal sequence", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      const draft = sql.indexOf("'draft'")
      const lines = sql.indexOf(
        "insert into public.journal_entry_lines",
      )
      const posted = sql.indexOf(
        "set status = 'posted'",
      )

      expect(draft).toBeGreaterThan(-1)
      expect(lines).toBeGreaterThan(draft)
      expect(posted).toBeGreaterThan(lines)
    })

    it("preserves accounting code behavior", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      for (
        const code of [
          "'1110'",
          "'1120'",
          "'1154'",
          "'1155'",
          "'1200'",
          "'2130'",
          "'2150'",
          "'4100'",
          "'5200'",
          "'5300'",
          "'5400'",
          "'5500'",
          "'5900'",
        ]
      ) {
        expect(sql).toContain(code)
      }
    })

    it("sets postgres ownership for all four RPCs", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\balter function\b[^;]*\bowner to postgres\b/g,
        ),
      ).toBe(4)
    })

    it("revokes PUBLIC and anon privileges", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom public\b/g,
        ),
      ).toBe(4)

      expect(
        countMatches(
          sql,
          /\brevoke all\b[^;]*\bon function\b[^;]*\bfrom anon\b/g,
        ),
      ).toBe(4)
    })

    it("grants execute to authenticated and service_role only", () => {
      if (!migrationExists) return

      const sql = normalize(readMigration())

      expect(
        countMatches(
          sql,
          /\bgrant execute\b[^;]*\bon function\b[^;]*\bto authenticated\b/g,
        ),
      ).toBe(4)

      expect(
        countMatches(
          sql,
          /\bgrant execute\b[^;]*\bon function\b[^;]*\bto service_role\b/g,
        ),
      ).toBe(4)

      expect(sql).not.toMatch(
        /\bgrant execute\b[^;]*\bto (?:public|anon)\b/,
      )
    })
  },
)
