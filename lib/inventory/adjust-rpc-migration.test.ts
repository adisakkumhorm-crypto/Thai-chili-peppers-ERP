import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261031100000_mod001_i5_adjust_rpc_current_schema.sql"
)

const sql = readFileSync(migrationPath, "utf8")
const compact = sql.replace(/\s+/g, " ")

describe("MOD-001 I-5 adjust RPC migration contract", () => {
  it("keeps the nine named RPC arguments while allowing omitted optional unit cost", () => {
    expect(compact).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_adjust_stock\(\s*p_org_id UUID,\s*p_product_id UUID,\s*p_location_id UUID,\s*p_quantity INTEGER,\s*p_unit_cost NUMERIC DEFAULT NULL,\s*p_reference_no TEXT DEFAULT NULL,\s*p_reason TEXT DEFAULT NULL,\s*p_idempotency_key TEXT DEFAULT NULL,\s*p_user_id UUID DEFAULT NULL\s*\)/
    )

    expect(compact).toContain(
      "Authenticated user context is required for stock adjustment"
    )
  })

  it("uses SECURITY INVOKER and an explicit search path", () => {
    expect(compact).toContain("SECURITY INVOKER")
    expect(compact).toContain("SET search_path = public, pg_temp")
  })

  it("maps the legacy p_reason RPC argument to current batch_qr_code storage", () => {
    const match = sql.match(
      /INSERT INTO public\.inventory_transactions\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\);/i
    )

    expect(match).not.toBeNull()

    const columns = match?.[1] ?? ""
    const values = match?.[2] ?? ""

    expect(columns).toMatch(/\bbatch_qr_code\b/)
    expect(columns).not.toMatch(/^\s*reason\s*,?$/im)
    expect(values).toMatch(/\bp_reason\b/)
  })

  it("enforces request-matching idempotency instead of silently accepting conflicts", () => {
    expect(compact).toContain(
      "Idempotency conflict: Key % used for a different request"
    )
    expect(compact).toContain("transaction_type = 'adjust'")
    expect(compact).toContain("quantity = p_quantity")
    expect(compact).toContain(
      "reference_no IS NOT DISTINCT FROM p_reference_no"
    )
    expect(compact).toContain(
      "batch_qr_code IS NOT DISTINCT FROM p_reason"
    )
  })

  it("preserves positive-adjust moving-average valuation protection", () => {
    expect(compact).toContain(
      "Positive adjustment requires explicit non-negative unit_cost"
    )
    expect(compact).toContain("OPENING_INVENTORY_REQUIRED")
    expect(compact).toContain(
      "v_new_avg_cost := ROUND(v_new_total_value / v_new_total_qty, 4)"
    )
  })

  it("protects allocated stock for negative adjustments", () => {
    expect(compact).toContain(
      "v_available_qty := v_balance.on_hand_quantity - v_balance.allocated_quantity"
    )
    expect(compact).toContain(
      "IF ABS(p_quantity) > v_available_qty THEN"
    )
    expect(compact).toContain(
      "Insufficient available stock for adjustment"
    )
  })

  it("consumes the exact remaining book value on full depletion", () => {
    expect(compact).toContain(
      "IF v_new_total_qty = 0 THEN"
    )
    expect(compact).toContain(
      "v_tx_total_cost := COALESCE(v_product.total_inventory_value, 0)"
    )
    expect(compact).toContain(
      "v_new_avg_cost := 0"
    )
    expect(compact).toContain(
      "v_new_total_value := 0"
    )
  })

  it("uses the product cost-readonly bypass and resets it", () => {
    expect(compact).toContain(
      "PERFORM set_config( 'app.bypass_cost_readonly', 'true', true )"
    )
    expect(compact).toContain(
      "PERFORM set_config( 'app.bypass_cost_readonly', 'false', true )"
    )
  })

  it("restricts RPC execution to authenticated and service-role callers", () => {
    expect(compact).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_adjust_stock\([\s\S]*?\) FROM PUBLIC;/
    )
    expect(compact).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_adjust_stock\([\s\S]*?\) TO authenticated, service_role;/
    )
  })
})
