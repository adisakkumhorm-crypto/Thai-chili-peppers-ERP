import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261031140000_mod001_i9_reserve_sales_order_item_rpc_current_schema.sql",
)

const migrationExists = existsSync(migrationPath)
const sql = migrationExists ? readFileSync(migrationPath, "utf8") : ""
const compact = sql.replace(/\s+/g, " ").trim()

function signatureArguments(): string[] {
  const match = sql.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.rpc_reserve_so_item\s*\(([\s\S]*?)\)\s*RETURNS\s+void/i,
  )

  if (!match) return []

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter(Boolean)
}

function position(text: string): number {
  return compact.indexOf(text.replace(/\s+/g, " ").trim())
}

describe("MOD-001 I-9 reserve sales-order-item RPC migration", () => {
  it("creates the expected migration file", () => {
    expect(migrationExists).toBe(true)
  })

  it("preserves the exact six-argument RPC signature", () => {
    expect(signatureArguments()).toEqual([
      "p_order_id uuid",
      "p_product_id uuid",
      "p_location_id uuid",
      "p_quantity integer",
      "p_unit_price numeric",
      "p_org_id uuid",
    ])
  })

  it("keeps the RPC return type void", () => {
    expect(compact).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_reserve_so_item\s*\([\s\S]*?\)\s*RETURNS\s+void/i,
    )
  })

  it("uses SECURITY INVOKER", () => {
    expect(compact).toMatch(/SECURITY INVOKER/i)
    expect(compact).not.toMatch(/SECURITY DEFINER/i)
  })

  it("locks search_path to public and pg_temp", () => {
    expect(compact).toMatch(/SET search_path = public, pg_temp/i)
  })

  it("does not introduce an idempotency argument or overload contract", () => {
    expect(sql).not.toMatch(/p_idempotency_key/i)
    expect(sql).not.toMatch(/DEFAULT\s+NULL/i)
  })

  it("rejects missing order id", () => {
    expect(compact).toMatch(/p_order_id IS NULL/i)
  })

  it("rejects missing product id", () => {
    expect(compact).toMatch(/p_product_id IS NULL/i)
  })

  it("rejects missing location id", () => {
    expect(compact).toMatch(/p_location_id IS NULL/i)
  })

  it("rejects missing org id", () => {
    expect(compact).toMatch(/p_org_id IS NULL/i)
  })

  it("rejects null or non-positive quantity", () => {
    expect(compact).toMatch(/p_quantity IS NULL OR p_quantity <= 0/i)
  })

  it("rejects null or negative unit price", () => {
    expect(compact).toMatch(/p_unit_price IS NULL OR p_unit_price < 0/i)
  })

  it("locks the sales order by id and org", () => {
    expect(compact).toMatch(
      /FROM public\.sales_orders WHERE id = p_order_id AND org_id = p_org_id FOR UPDATE/i,
    )
  })

  it("allows item mutation only while the order is pending", () => {
    expect(compact).toMatch(
      /v_order_status IS DISTINCT FROM 'pending'/i,
    )
  })

  it("explicitly validates the product belongs to the org", () => {
    expect(compact).toMatch(
      /FROM public\.products WHERE id = p_product_id AND org_id = p_org_id/i,
    )
  })

  it("locks the matching org/product/location balance", () => {
    expect(compact).toMatch(
      /FROM public\.inventory_balances WHERE product_id = p_product_id AND location_id = p_location_id AND org_id = p_org_id FOR UPDATE/i,
    )
  })

  it("computes available stock as on-hand minus allocated", () => {
    expect(compact).toMatch(
      /v_available := v_on_hand_quantity - v_allocated_quantity/i,
    )
  })

  it("fails when requested quantity exceeds available stock", () => {
    expect(compact).toMatch(/IF p_quantity > v_available THEN/i)
  })

  it("increments allocated quantity exactly by requested quantity", () => {
    expect(compact).toMatch(
      /SET allocated_quantity = allocated_quantity \+ p_quantity/i,
    )
  })

  it("inserts exactly one sales-order item mutation statement", () => {
    expect(
      (compact.match(/INSERT INTO public\.sales_order_items/gi) ?? []).length,
    ).toBe(1)
  })

  it("inserts org/order/product/location/quantity/unit price", () => {
    expect(compact).toMatch(
      /INSERT INTO public\.sales_order_items \( org_id, order_id, product_id, location_id, quantity, unit_price \)/i,
    )
  })

  it("recalculates total from sales_order_items after insertion", () => {
    expect(compact).toMatch(
      /SELECT COALESCE\(SUM\(quantity \* unit_price\), 0\) INTO v_new_total FROM public\.sales_order_items WHERE order_id = p_order_id AND org_id = p_org_id/i,
    )
  })

  it("updates the sales order total inside the RPC", () => {
    expect(compact).toMatch(
      /UPDATE public\.sales_orders SET total_amount = v_new_total, updated_at = NOW\(\) WHERE id = p_order_id AND org_id = p_org_id/i,
    )
  })

  it("preserves lock and mutation ordering", () => {
    const orderLock = position("FROM public.sales_orders")
    const productValidation = position("FROM public.products")
    const balanceLock = position("FROM public.inventory_balances")
    const balanceUpdate = position("UPDATE public.inventory_balances")
    const itemInsert = position("INSERT INTO public.sales_order_items")
    const totalRead = position(
      "SELECT COALESCE(SUM(quantity * unit_price), 0)",
    )
    const orderUpdate = position("UPDATE public.sales_orders")

    expect(orderLock).toBeGreaterThanOrEqual(0)
    expect(productValidation).toBeGreaterThan(orderLock)
    expect(balanceLock).toBeGreaterThan(productValidation)
    expect(balanceUpdate).toBeGreaterThan(balanceLock)
    expect(itemInsert).toBeGreaterThan(balanceUpdate)
    expect(totalRead).toBeGreaterThan(itemInsert)
    expect(orderUpdate).toBeGreaterThan(totalRead)
  })

  it("revokes execute exposure from PUBLIC", () => {
    expect(compact).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_reserve_so_item\(\s*uuid,\s*uuid,\s*uuid,\s*integer,\s*numeric,\s*uuid\s*\)\s+FROM\s+PUBLIC/i,
    )
  })

  it("revokes execute exposure from anon", () => {
    expect(compact).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_reserve_so_item\(\s*uuid,\s*uuid,\s*uuid,\s*integer,\s*numeric,\s*uuid\s*\)\s+FROM\s+anon/i,
    )
  })

  it("grants execute only to authenticated and service_role application roles", () => {
    expect(compact).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_reserve_so_item\(\s*uuid,\s*uuid,\s*uuid,\s*integer,\s*numeric,\s*uuid\s*\)\s+TO\s+authenticated/i,
    )
    expect(compact).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_reserve_so_item\(\s*uuid,\s*uuid,\s*uuid,\s*integer,\s*numeric,\s*uuid\s*\)\s+TO\s+service_role/i,
    )
  })

  it("does not modify deferred sales delete/ship/cancel RPCs", () => {
    expect(sql).not.toMatch(/rpc_delete_so_item/i)
    expect(sql).not.toMatch(/rpc_ship_sales_order/i)
    expect(sql).not.toMatch(/rpc_cancel_sales_order_reservation/i)
  })
})
