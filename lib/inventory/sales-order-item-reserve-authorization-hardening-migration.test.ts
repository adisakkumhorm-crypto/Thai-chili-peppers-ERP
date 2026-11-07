import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261104130000_mod011_sales_order_item_reserve_authorization_hardening.sql",
)

const sql = readFileSync(migrationPath, "utf8")

describe("MOD-011 sales order item reserve authorization hardening", () => {
  it("uses one transaction and replaces exactly one reserve RPC", () => {
    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1)

    expect(
      sql.match(
        /CREATE OR REPLACE FUNCTION public\.rpc_reserve_so_item\(/gi,
      ),
    ).toHaveLength(1)
  })

  it("preserves the exact six-argument RPC identity and void return", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_reserve_so_item\(\s*p_order_id uuid,\s*p_product_id uuid,\s*p_location_id uuid,\s*p_quantity integer,\s*p_unit_price numeric,\s*p_org_id uuid\s*\)/i,
    )

    expect(sql).toMatch(/RETURNS void/i)
    expect(sql).not.toMatch(/\bp_user_id\b/i)
  })

  it("preserves SECURITY INVOKER, owner, and search path", () => {
    expect(sql).toMatch(/SECURITY INVOKER/i)

    expect(sql).toMatch(
      /SET search_path = public, pg_temp/i,
    )

    expect(sql).toMatch(
      /ALTER FUNCTION public\.rpc_reserve_so_item\(uuid, uuid, uuid, integer, numeric, uuid\)\s*OWNER TO postgres/i,
    )

    expect(sql).not.toMatch(/SECURITY DEFINER/i)
  })

  it("preserves authenticated and service_role execution only", () => {
    expect(sql).toMatch(
      /REVOKE ALL\s+ON FUNCTION public\.rpc_reserve_so_item\(uuid, uuid, uuid, integer, numeric, uuid\)\s+FROM PUBLIC/i,
    )

    expect(sql).toMatch(
      /REVOKE ALL\s+ON FUNCTION public\.rpc_reserve_so_item\(uuid, uuid, uuid, integer, numeric, uuid\)\s+FROM anon/i,
    )

    expect(sql).toMatch(
      /GRANT EXECUTE\s+ON FUNCTION public\.rpc_reserve_so_item\(uuid, uuid, uuid, integer, numeric, uuid\)\s+TO authenticated/i,
    )

    expect(sql).toMatch(
      /GRANT EXECUTE\s+ON FUNCTION public\.rpc_reserve_so_item\(uuid, uuid, uuid, integer, numeric, uuid\)\s+TO service_role/i,
    )
  })

  it("requires auth.uid for authenticated callers", () => {
    expect(sql).toMatch(
      /IF current_user = 'authenticated' THEN/i,
    )

    expect(sql).toMatch(
      /IF auth\.uid\(\) IS NULL THEN/i,
    )

    expect(sql).toMatch(
      /SALES_ORDER_ITEM_RESERVE_AUTH_REQUIRED/i,
    )
  })

  it("requires inline organization membership", () => {
    expect(sql).toMatch(/FROM public\.memberships m/i)
    expect(sql).toMatch(/m\.org_id = p_org_id/i)
    expect(sql).toMatch(/m\.user_id = auth\.uid\(\)/i)

    expect(sql).toMatch(
      /SALES_ORDER_ITEM_RESERVE_ORG_FORBIDDEN/i,
    )
  })

  it("allows trusted service_role and rejects other callers", () => {
    expect(sql).toMatch(
      /ELSIF current_user = 'service_role' THEN\s+NULL;/i,
    )

    expect(sql).toMatch(
      /SALES_ORDER_ITEM_RESERVE_CALLER_FORBIDDEN/i,
    )
  })

  it("uses SQLSTATE 42501 for all authorization failures", () => {
    expect(
      sql.match(/USING ERRCODE = '42501'/g),
    ).toHaveLength(3)
  })

  it("places the authorization guard before argument validation", () => {
    const guard = sql.indexOf(
      "MOD011_AUTH_GUARD_BEGIN:RESERVE_SO_ITEM",
    )

    const firstBusinessValidation = sql.indexOf(
      "IF p_order_id IS NULL THEN",
    )

    expect(guard).toBeGreaterThan(-1)
    expect(firstBusinessValidation).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(firstBusinessValidation)
  })

  it("does not expand the private-schema or RLS boundary", () => {
    expect(sql).not.toMatch(/private\.is_org_member/i)
    expect(sql).not.toMatch(/ALTER TABLE/i)
    expect(sql).not.toMatch(/CREATE POLICY/i)
    expect(sql).not.toMatch(/DROP POLICY/i)
    expect(sql).not.toMatch(/GRANT USAGE ON SCHEMA private/i)
  })

  it("preserves critical reserve business behavior and lock order", () => {
    const orderLock = sql.search(
      /FROM public\.sales_orders\s+WHERE id = p_order_id\s+AND org_id = p_org_id\s+FOR UPDATE/i,
    )

    const balanceLock = sql.search(
      /FROM public\.inventory_balances\s+WHERE product_id = p_product_id\s+AND location_id = p_location_id\s+AND org_id = p_org_id\s+FOR UPDATE/i,
    )

    expect(orderLock).toBeGreaterThan(-1)
    expect(balanceLock).toBeGreaterThan(-1)
    expect(orderLock).toBeLessThan(balanceLock)

    expect(sql).toMatch(
      /FROM public\.products\s+WHERE id = p_product_id\s+AND org_id = p_org_id/i,
    )

    expect(sql).toMatch(
      /UPDATE public\.inventory_balances\s+SET allocated_quantity = allocated_quantity \+ p_quantity/i,
    )

    expect(sql).toMatch(
      /INSERT INTO public\.sales_order_items/i,
    )

    expect(sql).toMatch(
      /SELECT COALESCE\(SUM\(quantity \* unit_price\), 0\)\s+INTO v_new_total\s+FROM public\.sales_order_items/i,
    )

    expect(sql).toMatch(
      /UPDATE public\.sales_orders\s+SET\s+total_amount = v_new_total,\s+updated_at = NOW\(\)/i,
    )
  })
})
