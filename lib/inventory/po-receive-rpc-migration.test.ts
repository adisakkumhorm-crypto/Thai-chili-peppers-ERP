import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261031110000_mod001_i6_po_receive_rpc_current_schema.sql"
)

const sql = readFileSync(migrationPath, "utf8")
const compact = sql.replace(/\s+/g, " ")

describe("MOD-001 I-6 PO receive RPC migration", () => {
  it("keeps the existing six-argument RPC signature", () => {
    expect(compact).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_receive_po_items\(\s*p_po_id UUID,\s*p_location_id UUID,\s*p_org_id UUID,\s*p_user_id UUID,\s*p_items JSONB,\s*p_idempotency_key TEXT DEFAULT NULL\s*\)/
    )
  })

  it("runs as SECURITY INVOKER with a bounded search_path", () => {
    expect(compact).toContain("SECURITY INVOKER")
    expect(compact).toMatch(
      /SET search_path = public, pg_temp/
    )
  })

  it("rejects empty, zero and negative receipt batches", () => {
    expect(compact).toContain("No items to receive")
    expect(compact).toContain(
      "PO receipt quantities must be greater than 0"
    )
    expect(compact).toMatch(
      /quantityToReceive'\)::INTEGER <= 0/
    )
  })

  it("requires one batch idempotency key", () => {
    expect(compact).toContain(
      "Idempotency key is required for PO receipt"
    )
  })

  it("rejects duplicate PO item ids", () => {
    expect(compact).toContain(
      "Duplicate PO item ids are not allowed in one receipt batch"
    )
    expect(compact).toContain(
      "count(DISTINCT (j.item->>'id')::UUID)"
    )
  })

  it("validates that the target location belongs to the organization", () => {
    expect(compact).toMatch(
      /FROM public\.inventory_locations WHERE id = p_location_id AND org_id = p_org_id/
    )
    expect(compact).toContain(
      "Inventory location not found or access denied"
    )
  })

  it("uses the PO item as authoritative product identity", () => {
    expect(compact).toContain(
      "PO item product does not match supplied product_id"
    )
    expect(compact).toContain(
      "v_po_item.product_id"
    )
    expect(compact).toMatch(
      /v_supplied_product_id <> v_po_item\.product_id/
    )
  })

  it("locks products deterministically before PO items", () => {
    const productLock = compact.indexOf(
      "Preserve the Inventory lock hierarchy: Products first"
    )
    const itemLock = compact.indexOf(
      "Then lock the requested PO items deterministically"
    )

    expect(productLock).toBeGreaterThan(-1)
    expect(itemLock).toBeGreaterThan(productLock)
    expect(compact).toContain("ORDER BY p.id FOR UPDATE OF p")
    expect(compact).toContain(
      "ORDER BY poi.id FOR UPDATE OF poi"
    )
  })

  it("derives a unique transaction idempotency key per PO item", () => {
    expect(compact).toContain(
      "p_idempotency_key || ':po-item:'"
    )
    expect(compact).toContain(
      "v_tx_key_prefix || v_po_item_id::TEXT"
    )

    expect(compact).not.toMatch(
      /VALUES \([\s\S]*?p_idempotency_key,[\s\S]*?v_unit_cost/
    )
  })

  it("fails closed on partial or changed batch replays", () => {
    expect(compact).toContain(
      "v_existing_batch_tx_count"
    )
    expect(compact).toContain(
      "v_exact_batch_tx_count"
    )
    expect(compact).toContain(
      "Idempotency conflict: PO receipt key % is partial or belongs to a different request"
    )
  })

  it("returns only when the entire prior batch exactly matches", () => {
    expect(compact).toMatch(
      /IF v_existing_batch_tx_count = v_request_count AND v_exact_batch_tx_count = v_request_count THEN RETURN;/
    )
  })

  it("preserves the legacy unvalued-stock guard", () => {
    expect(compact).toContain(
      "OPENING_INVENTORY_REQUIRED"
    )
  })

  it("uses PO item unit price and moving-average valuation", () => {
    expect(compact).toContain(
      "v_unit_cost := ROUND(v_po_item.unit_price::NUMERIC, 4)"
    )
    expect(compact).toContain(
      "v_new_total_value / v_new_total_qty"
    )
    expect(compact).toContain(
      "average_cost = v_new_avg_cost"
    )
  })

  it("updates PO status only after the positive receipt loop", () => {
    const receiptLoop = compact.indexOf(
      "Execute each positive receipt line atomically"
    )
    const statusBlock = compact.indexOf(
      "Recalculate PO status only after at least one strictly-positive"
    )

    expect(receiptLoop).toBeGreaterThan(-1)
    expect(statusBlock).toBeGreaterThan(receiptLoop)
  })

  it("hardens execution ACL against both PUBLIC and anon", () => {
    expect(compact).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_receive_po_items\(\s*UUID,\s*UUID,\s*UUID,\s*UUID,\s*JSONB,\s*TEXT\s*\) FROM PUBLIC, anon;/
    )

    expect(compact).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_receive_po_items\(\s*UUID,\s*UUID,\s*UUID,\s*UUID,\s*JSONB,\s*TEXT\s*\) TO authenticated, service_role;/
    )
  })
})
