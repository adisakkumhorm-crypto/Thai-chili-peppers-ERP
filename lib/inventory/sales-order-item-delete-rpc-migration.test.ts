import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20261101090000_mod001_i10_delete_sales_order_item_rpc_current_schema.sql"
)

const readMigration = () => fs.readFileSync(migrationPath, "utf8")

const compact = (sql: string) =>
  sql
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("MOD-001 I-10 hardened rpc_delete_so_item migration", () => {
  it("exists at the locked migration path", () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it("preserves the existing two-argument RPC identity", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_delete_so_item\s*\(\s*p_item_id uuid\s*,\s*p_org_id uuid\s*\)/i
    )

    expect(sql).not.toMatch(/p_product_id/i)
    expect(sql).not.toMatch(/p_quantity/i)
    expect(sql).not.toMatch(/p_idempotency_key/i)
  })

  it("uses SECURITY INVOKER with a locked search_path", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(/LANGUAGE plpgsql/i)
    expect(sql).toMatch(/SECURITY INVOKER/i)
    expect(sql).toMatch(/SET search_path = public, pg_temp/i)
  })

  it("keeps order lock before item lock before balance lock", () => {
    const sql = compact(readMigration())

    const orderLock = sql.search(
      /FROM public\.sales_orders [^;]*?FOR UPDATE/i
    )

    const itemLock = sql.search(
      /FROM public\.sales_order_items [^;]*?FOR UPDATE/i
    )

    const balanceLock = sql.search(
      /FROM public\.inventory_balances [^;]*?FOR UPDATE/i
    )

    expect(orderLock).toBeGreaterThanOrEqual(0)
    expect(itemLock).toBeGreaterThan(orderLock)
    expect(balanceLock).toBeGreaterThan(itemLock)
  })

  it("keeps organization scoping and pending-order protection", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /sales_order_items .*? id = p_item_id .*? org_id = p_org_id/i
    )

    expect(sql).toMatch(
      /sales_orders .*? id = v_item\.order_id .*? org_id = p_org_id/i
    )

    expect(sql).toMatch(
      /v_order_status .*? pending/i
    )
  })

  it("rejects null location and malformed stored quantity", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /v_item\.location_id IS NULL/i
    )

    expect(sql).toMatch(
      /v_item\.quantity IS NULL OR v_item\.quantity <= 0/i
    )
  })

  it("requires an organization-scoped matching inventory balance", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /FROM public\.inventory_balances [^;]*?product_id = v_item\.product_id [^;]*?location_id = v_item\.location_id [^;]*?org_id = p_org_id [^;]*?FOR UPDATE/i
    )

    expect(sql).toMatch(
      /Inventory balance not found/i
    )
  })

  it("rejects allocation mismatch before releasing allocation", () => {
    const sql = compact(readMigration())

    const guard = sql.search(
      /v_current_allocated < v_item\.quantity/i
    )

    const release = sql.search(
      /UPDATE public\.inventory_balances SET allocated_quantity = allocated_quantity - v_item\.quantity/i
    )

    expect(guard).toBeGreaterThanOrEqual(0)
    expect(release).toBeGreaterThan(guard)
  })

  it("deletes the selected item and recalculates the order total", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /DELETE FROM public\.sales_order_items WHERE id = p_item_id AND org_id = p_org_id/i
    )

    expect(sql).toMatch(
      /COALESCE\s*\(\s*SUM\s*\(\s*quantity \* unit_price\s*\)\s*,\s*0\s*\)/i
    )

    expect(sql).toMatch(
      /UPDATE public\.sales_orders SET total_amount = v_new_total/i
    )
  })

  it("hardens ownership and EXECUTE ACL", () => {
    const sql = compact(readMigration())

    expect(sql).toMatch(
      /ALTER FUNCTION public\.rpc_delete_so_item\s*\(\s*uuid\s*,\s*uuid\s*\)\s*OWNER TO postgres/i
    )

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_delete_so_item\s*\(\s*uuid\s*,\s*uuid\s*\)\s*FROM PUBLIC/i
    )

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_delete_so_item\s*\(\s*uuid\s*,\s*uuid\s*\)\s*FROM anon/i
    )

    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_delete_so_item\s*\(\s*uuid\s*,\s*uuid\s*\)\s*TO authenticated/i
    )

    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_delete_so_item\s*\(\s*uuid\s*,\s*uuid\s*\)\s*TO service_role/i
    )
  })

  it("does not modify closed I-9 reserve/ship/cancel RPCs", () => {
    const sql = readMigration()

    expect(sql).not.toMatch(/rpc_reserve_so_item/i)
    expect(sql).not.toMatch(/rpc_ship_sales_order/i)
    expect(sql).not.toMatch(/rpc_cancel_sales_order_reservation/i)
  })
})
