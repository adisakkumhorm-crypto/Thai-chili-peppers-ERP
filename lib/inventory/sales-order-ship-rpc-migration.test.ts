import {
  existsSync,
  readFileSync,
} from "node:fs"
import path from "node:path"

import {
  describe,
  expect,
  it,
} from "vitest"

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20261031130000_mod001_i8_ship_sales_order_rpc_current_schema.sql"
)

const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : ""

const compact = sql.replace(/\s+/g, " ").trim()

describe("I-8 ship sales order RPC migration", () => {
  it("creates exactly the four-argument ship RPC", () => {
    expect(
      (
        sql.match(
          /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.rpc_ship_sales_order/gi
        ) ?? []
      ).length
    ).toBe(1)

    expect(compact).toMatch(
      /rpc_ship_sales_order\s*\(\s*p_order_id uuid,\s*p_user_id uuid,\s*p_org_id uuid,\s*p_idempotency_key text DEFAULT NULL/
    )
  })

  it("keeps the RPC as SECURITY INVOKER", () => {
    expect(compact).toMatch(
      /LANGUAGE plpgsql SECURITY INVOKER/
    )
  })

  it("locks the function search path", () => {
    expect(compact).toMatch(
      /SET search_path = public, pg_temp/
    )
  })

  it("removes anonymous and PUBLIC execution", () => {
    expect(compact).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_ship_sales_order\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*,\s*text\s*\)\s+FROM\s+PUBLIC/
    )

    expect(compact).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_ship_sales_order\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*,\s*text\s*\)\s+FROM\s+anon/
    )
  })

  it("grants execution only to authenticated app roles", () => {
    expect(compact).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_ship_sales_order\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*,\s*text\s*\)\s+TO\s+authenticated/
    )

    expect(compact).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_ship_sales_order\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*,\s*text\s*\)\s+TO\s+service_role/
    )
  })

  it("locks the sales order by order and organization", () => {
    expect(compact).toMatch(
      /FROM public\.sales_orders WHERE id = p_order_id AND org_id = p_org_id FOR UPDATE/
    )
  })

  it("preserves shipped replay as idempotent success", () => {
    expect(compact).toMatch(
      /status = 'shipped'.*Already shipped/
    )
  })

  it("rejects both cancelled and delivered orders", () => {
    expect(compact).toMatch(
      /status IN \('cancelled', 'delivered'\)/
    )
  })

  it("locks all order items in deterministic stock-compatible order", () => {
    expect(compact).toMatch(
      /PERFORM 1 FROM public\.sales_order_items WHERE order_id = p_order_id AND org_id = p_org_id ORDER BY product_id, location_id, id FOR UPDATE/
    )
  })

  it("rejects an order with no items", () => {
    expect(compact).toMatch(
      /Sales order % has no items to ship/
    )
  })

  it("rejects non-positive item quantity", () => {
    expect(compact).toMatch(
      /v_item\.quantity <= 0/
    )

    expect(compact).toMatch(
      /Sales order item % has invalid quantity/
    )
  })

  it("rejects null item location", () => {
    expect(compact).toMatch(
      /v_item\.location_id IS NULL/
    )

    expect(compact).toMatch(
      /LEGACY_SALES_EXCEPTION/
    )
  })

  it("does not silently skip invalid items", () => {
    expect(compact).not.toMatch(
      /IF v_item\.location_id IS NOT NULL AND v_item\.quantity > 0 THEN/
    )
  })

  it("uses deterministic shipment idempotency keys", () => {
    expect(compact).toContain(
      "'sales-shipped:'"
    )

    expect(compact).toMatch(
      /COALESCE\s*\(\s*p_idempotency_key\s*,\s*p_order_id::text\s*\)/
    )

    expect(compact).toContain(
      "v_item.id::text"
    )

    expect(compact).not.toMatch(
      /gen_random_uuid\s*\(/
    )
  })

  it("delegates stock mutation to ALLOCATED_FULFILLMENT", () => {
    expect(compact).toMatch(
      /public\.rpc_issue_stock\s*\(/
    )

    expect(compact).toContain(
      "'ALLOCATED_FULFILLMENT'"
    )
  })

  it("passes user identity only as compatibility/audit metadata", () => {
    expect(compact).toMatch(
      /public\.rpc_issue_stock\s*\([^;]*p_user_id/
    )

    expect(compact).not.toMatch(
      /auth\.uid\s*\(/
    )
  })

  it("lets rpc_issue_stock derive product and location from the item", () => {
    expect(compact).toMatch(
      /p_user_id,\s*NULL,\s*NULL,\s*v_so_record\.order_number,\s*v_item\.id/
    )
  })

  it("updates order status only after stock issuing logic", () => {
    const issueIndex =
      compact.indexOf("public.rpc_issue_stock")

    const shippedUpdateIndex =
      compact.indexOf(
        "UPDATE public.sales_orders SET status = 'shipped'::sales_order_status"
      )

    expect(issueIndex).toBeGreaterThan(-1)
    expect(shippedUpdateIndex).toBeGreaterThan(
      issueIndex
    )
  })

  it("does not redefine rpc_issue_stock or the I-7 cancel RPC", () => {
    expect(sql).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.rpc_issue_stock/i
    )

    expect(sql).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.rpc_cancel_sales_order_reservation/i
    )
  })
})
