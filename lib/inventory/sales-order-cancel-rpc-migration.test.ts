import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20261031120000_mod001_i7_cancel_sales_order_reservation_rpc_current_schema.sql"
)

function readMigration(): string {
  return fs.readFileSync(migrationPath, "utf8")
}

describe("MOD-001 I-7 sales-order cancellation RPC migration", () => {
  it("preserves the exact three-argument RPC signature and jsonb return", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_cancel_sales_order_reservation\s*\(\s*p_order_id uuid,\s*p_user_id uuid,\s*p_org_id uuid\s*\)\s*RETURNS jsonb/i
    )
  })

  it("is SECURITY INVOKER with an explicit safe search_path", () => {
    const sql = readMigration()

    expect(sql).toMatch(/SECURITY INVOKER/i)
    expect(sql).toMatch(/SET search_path = public, pg_temp/i)
  })

  it("removes PUBLIC and anon execution while retaining authenticated and service_role", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_cancel_sales_order_reservation\(\s*uuid,\s*uuid,\s*uuid\s*\)\s+FROM\s+PUBLIC/i
    )

    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_cancel_sales_order_reservation\(\s*uuid,\s*uuid,\s*uuid\s*\)\s+FROM\s+anon/i
    )

    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_cancel_sales_order_reservation\(\s*uuid,\s*uuid,\s*uuid\s*\)\s+TO\s+authenticated/i
    )

    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_cancel_sales_order_reservation\(\s*uuid,\s*uuid,\s*uuid\s*\)\s+TO\s+service_role/i
    )
  })

  it("locks the target sales-order header by order and organization", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /FROM public\.sales_orders[\s\S]*WHERE id = p_order_id[\s\S]*AND org_id = p_org_id[\s\S]*FOR UPDATE/i
    )
  })

  it("preserves already-cancelled idempotent success", () => {
    const sql = readMigration()

    expect(sql).toContain("Already cancelled")
    expect(sql).toMatch(
      /IF v_so_record\.status = 'cancelled' THEN[\s\S]*RETURN jsonb_build_object/i
    )
  })

  it("rejects shipped and delivered orders", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /v_so_record\.status IN \('shipped', 'delivered'\)/i
    )
  })

  it("restricts cancellation to pending, paid, or packing states", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /v_so_record\.status NOT IN \('pending', 'paid', 'packing'\)/i
    )
  })

  it("locks sales-order items in deterministic product/location/id order", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /FROM public\.sales_order_items[\s\S]*WHERE order_id = p_order_id[\s\S]*AND org_id = p_org_id[\s\S]*ORDER BY product_id,\s*location_id,\s*id[\s\S]*FOR UPDATE/i
    )
  })

  it("rejects non-positive reserved item quantities", () => {
    const sql = readMigration()

    expect(sql).toMatch(/IF v_item\.quantity <= 0 THEN/i)
    expect(sql).toContain("Invalid sales order item quantity")
  })

  it("rejects legacy/null reservation locations instead of silently skipping them", () => {
    const sql = readMigration()

    expect(sql).toMatch(/IF v_item\.location_id IS NULL THEN/i)
    expect(sql).toContain("LEGACY_SALES_EXCEPTION")
    expect(sql).not.toMatch(
      /IF v_item\.location_id IS NOT NULL AND v_item\.quantity > 0 THEN/i
    )
  })

  it("locks every required balance before any allocation mutation", () => {
    const sql = readMigration()

    const balanceLock = sql.indexOf(
      "FROM public.inventory_balances"
    )

    const firstBalanceUpdate = sql.indexOf(
      "UPDATE public.inventory_balances"
    )

    expect(balanceLock).toBeGreaterThan(-1)
    expect(firstBalanceUpdate).toBeGreaterThan(balanceLock)

    expect(sql).toMatch(
      /FROM public\.inventory_balances[\s\S]*org_id = p_org_id[\s\S]*FOR UPDATE/i
    )
  })

  it("fails closed when a reservation balance is missing", () => {
    const sql = readMigration()

    expect(sql).toContain(
      "Inventory balance not found for product"
    )
  })

  it("rejects allocation mismatch instead of clamping to zero", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /IF v_allocated_quantity < v_group\.reserved_quantity THEN/i
    )

    expect(sql).toContain("Allocation mismatch")
    expect(sql).not.toMatch(/GREATEST\s*\(\s*0/i)
  })

  it("decrements the exact aggregated reservation quantity", () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /allocated_quantity\s*=\s*allocated_quantity\s*-\s*v_group\.reserved_quantity/i
    )
  })

  it("changes order status only after reservation release logic", () => {
    const sql = readMigration()

    const releaseIndex = sql.search(
      /allocated_quantity\s*=\s*allocated_quantity\s*-\s*v_group\.reserved_quantity/i
    )

    const cancelIndex = sql.search(
      /SET\s+status\s*=\s*'cancelled'::sales_order_status/i
    )

    expect(releaseIndex).toBeGreaterThan(-1)
    expect(cancelIndex).toBeGreaterThan(releaseIndex)
  })

  it("does not scope-creep into ship, reserve, or delete RPC definitions", () => {
    const sql = readMigration()

    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.rpc_ship_sales_order/i)
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.rpc_reserve_so_item/i)
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.rpc_delete_so_item/i)
  })
})
