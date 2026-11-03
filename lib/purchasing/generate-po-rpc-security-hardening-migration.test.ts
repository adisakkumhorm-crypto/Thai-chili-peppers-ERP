import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261103100000_mod003_purchase_generate_po_security_hardening.sql",
)

const migration = fs.readFileSync(
  migrationPath,
  "utf8",
)

const normalized = migration
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase()

describe(
  "MOD-003 generate_po_from_pr security hardening migration",
  () => {
    it("does not alter table structure", () => {
      expect(normalized).not.toMatch(/\balter table\b/)
      expect(normalized).not.toMatch(/\bcreate table\b/)
      expect(normalized).not.toMatch(/\bdrop table\b/)
    })

    it("replaces exactly one intended RPC", () => {
      const matches =
        normalized.match(
          /\bcreate or replace function public\.generate_po_from_pr\s*\(/g,
        ) ?? []

      expect(matches).toHaveLength(1)
    })

    it("preserves exact signature and return type", () => {
      expect(normalized).toMatch(
        /create or replace function public\.generate_po_from_pr\s*\(\s*p_pr_id uuid\s*,\s*p_user_id uuid\s*\)/,
      )
      expect(normalized).toMatch(/\breturns uuid\b/)
    })

    it("preserves SECURITY DEFINER and locks search_path", () => {
      expect(normalized).toMatch(/\bsecurity definer\b/)
      expect(normalized).toMatch(
        /\bset search_path\s*=\s*public\s*,\s*pg_temp\b/,
      )
    })

    it("binds actor identity for non-service callers", () => {
      expect(normalized).toMatch(/auth\.role\(\)/)
      expect(normalized).toMatch(
        /v_actor\s*:=\s*auth\.uid\(\)/,
      )
      expect(normalized).toMatch(
        /p_user_id is distinct from v_actor/,
      )
      expect(normalized).toContain(
        "purchase_actor_mismatch",
      )
    })

    it("requires organization membership", () => {
      expect(normalized).toMatch(
        /private\.is_org_member\s*\(\s*v_pr\.org_id\s*\)/,
      )
      expect(normalized).toContain(
        "purchase_org_forbidden",
      )
    })

    it("enforces owner admin or procurement permission", () => {
      expect(normalized).toMatch(
        /m\.role in\s*\(\s*'owner'::public\.role_enum\s*,\s*'admin'::public\.role_enum\s*\)/,
      )
      expect(normalized).toMatch(
        /e\.department[\s\S]*?'procurement'/,
      )
      expect(normalized).toContain(
        "purchase_permission_forbidden",
      )
    })

    it("preserves PR row lock", () => {
      expect(normalized).toMatch(
        /from public\.purchase_requests where id = p_pr_id for update/,
      )
    })

    it("preserves approved and duplicate guards", () => {
      expect(normalized).toContain(
        "only approved prs can be generated into pos",
      )
      expect(normalized).toMatch(
        /v_pr\.po_id is not null/,
      )
    })

    it("validates selected quotation scope", () => {
      expect(normalized).toMatch(
        /from public\.pr_quotations where id = v_pr\.selected_quotation_id and pr_id = v_pr\.id and org_id = v_pr\.org_id/,
      )
      expect(normalized).toContain(
        "purchase_quotation_scope_mismatch",
      )
    })

    it("validates supplier org", () => {
      expect(normalized).toMatch(
        /from public\.suppliers s where s\.id = v_quote\.supplier_id and s\.org_id = v_pr\.org_id/,
      )
      expect(normalized).toContain(
        "purchase_supplier_org_mismatch",
      )
    })

    it("validates project org", () => {
      expect(normalized).toMatch(
        /from public\.projects p where p\.id = v_pr\.project_id and p\.org_id = v_pr\.org_id/,
      )
      expect(normalized).toContain(
        "purchase_project_org_mismatch",
      )
    })

    it("validates PR item org", () => {
      expect(normalized).toContain(
        "purchase_pr_item_org_mismatch",
      )
      expect(normalized).toMatch(
        /i\.org_id is distinct from v_pr\.org_id/,
      )
    })

    it("validates product org", () => {
      expect(normalized).toContain(
        "purchase_product_org_mismatch",
      )
      expect(normalized).toMatch(
        /left join public\.products p on p\.id = i\.product_id/,
      )
    })

    it("preserves quotation price calculations", () => {
      expect(normalized).toMatch(
        /v_quote\.price\s*\/\s*v_quote\.quantity/,
      )
      expect(normalized).toMatch(
        /v_quote\.price\s*\/\s*v_total_qty/,
      )
    })

    it("preserves PO header and item creation", () => {
      expect(normalized).toMatch(
        /\binsert into public\.purchase_orders\b/,
      )
      expect(normalized).toMatch(
        /\binsert into public\.purchase_order_items\b/,
      )
    })

    it("preserves PR po_created transition", () => {
      expect(normalized).toMatch(
        /\bupdate public\.purchase_requests\b/,
      )
      expect(normalized).toContain(
        "'po_created'::public.pr_status",
      )
      expect(normalized).toMatch(
        /po_created_by\s*=\s*p_user_id/,
      )
    })

    it("does not introduce composite schema changes", () => {
      expect(normalized).not.toMatch(/\badd constraint\b/)
      expect(normalized).not.toMatch(/\bforeign key\b/)
      expect(normalized).not.toMatch(/\bunique\s*\(/)
    })

    it("revokes PUBLIC and anon execution", () => {
      expect(normalized).toMatch(
        /revoke all on function public\.generate_po_from_pr\s*\(\s*uuid\s*,\s*uuid\s*\) from public/,
      )
      expect(normalized).toMatch(
        /revoke all on function public\.generate_po_from_pr\s*\(\s*uuid\s*,\s*uuid\s*\) from anon/,
      )
    })

    it("grants authenticated and service_role", () => {
      expect(normalized).toMatch(
        /grant execute on function public\.generate_po_from_pr\s*\(\s*uuid\s*,\s*uuid\s*\) to authenticated/,
      )
      expect(normalized).toMatch(
        /grant execute on function public\.generate_po_from_pr\s*\(\s*uuid\s*,\s*uuid\s*\) to service_role/,
      )
    })

    it("preserves postgres ownership", () => {
      expect(normalized).toMatch(
        /alter function public\.generate_po_from_pr\s*\(\s*uuid\s*,\s*uuid\s*\) owner to postgres/,
      )
    })
  },
)
