import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261103120000_mod006_po_approval_authorization_boundary.sql",
  ),
  "utf8",
)

describe("MOD-006 PO approval authorization boundary", () => {
  it("creates a database-authoritative PO update trigger", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private.guard_purchase_order_approval_boundary()",
    )
    expect(migration).toContain(
      "BEFORE UPDATE\nON public.purchase_orders",
    )
  })

  it("creates a commercial-item integrity trigger", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private.guard_purchase_order_item_boundary()",
    )
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OR DELETE\nON public.purchase_order_items",
    )
  })

  it("requires authenticated request and approval actors", () => {
    expect(migration).toContain("v_actor := auth.uid()")
    expect(migration).toContain(
      "PURCHASE_APPROVAL_AUTH_REQUIRED",
    )
  })

  it("server-stamps request provenance", () => {
    expect(migration).toContain(
      "NEW.requested_by := v_actor",
    )
  })

  it("denies self approval", () => {
    expect(migration).toContain(
      "IF OLD.requested_by = v_actor",
    )
    expect(migration).toContain(
      "PURCHASE_SELF_APPROVAL_FORBIDDEN",
    )
  })

  it("uses user-specific approval limits", () => {
    expect(migration).toContain(
      "FROM public.approval_limits al",
    )
    expect(migration).toContain(
      "AND al.user_id = v_actor",
    )
    expect(migration).toContain(
      "AND al.max_amount >= v_total",
    )
    expect(migration).not.toContain("al.role_name")
  })

  it("preserves owner/admin approval-limit bypass", () => {
    expect(migration).toContain(
      "m.role::text IN ('owner', 'admin')",
    )
  })

  it("recomputes the authoritative approval total from PO items", () => {
    expect(migration).toContain(
      "poi.quantity::numeric",
    )
    expect(migration).toContain(
      "poi.unit_price::numeric",
    )
    expect(migration).toContain(
      "NEW.total_amount := v_total",
    )
  })

  it("server-stamps approval provenance", () => {
    expect(migration).toContain(
      "NEW.approved_by := v_actor",
    )
    expect(migration).toContain(
      "NEW.approved_at := statement_timestamp()",
    )
  })

  it("writes approval audit evidence", () => {
    expect(migration).toContain(
      "INSERT INTO public.audit_log",
    )
    expect(migration).toContain(
      "'purchase_orders'",
    )
    expect(migration).toContain(
      "'APPROVE_PO'",
    )
  })

  it("blocks pre-approval status bypasses", () => {
    expect(migration).toContain(
      "PURCHASE_PO_APPROVAL_TRANSITION_REQUIRED",
    )
    expect(migration).toContain(
      "PURCHASE_PO_APPROVAL_REVERSAL_FORBIDDEN",
    )
  })

  it("protects approval provenance outside authoritative transitions", () => {
    expect(migration).toContain(
      "PURCHASE_REQUEST_PROVENANCE_IMMUTABLE",
    )
    expect(migration).toContain(
      "PURCHASE_APPROVAL_PROVENANCE_IMMUTABLE",
    )
  })

  it("freezes approved header value after draft", () => {
    expect(migration).toContain(
      "PURCHASE_PO_TOTAL_LOCKED",
    )
    expect(migration).toContain(
      "PURCHASE_PO_COMMERCIAL_HEADER_LOCKED",
    )
  })

  it("freezes commercial item fields after draft", () => {
    expect(migration).toContain(
      "PURCHASE_PO_ITEMS_LOCKED_AFTER_DRAFT",
    )
    expect(migration).toContain(
      "PURCHASE_PO_ITEM_COMMERCIAL_FIELDS_LOCKED",
    )
    expect(migration).toContain(
      "NEW.quantity IS DISTINCT FROM OLD.quantity",
    )
    expect(migration).toContain(
      "NEW.unit_price IS DISTINCT FROM OLD.unit_price",
    )
  })

  it("does not freeze received_quantity", () => {
    const commercialComparison = migration.slice(
      migration.indexOf(
        "IF v_old_status::text <> 'draft'",
      ),
      migration.indexOf(
        "RETURN NEW;",
        migration.indexOf(
          "IF v_old_status::text <> 'draft'",
        ),
      ),
    )

    expect(commercialComparison).not.toContain(
      "NEW.received_quantity",
    )
  })

  it("does not rewrite or harden the existing receive RPC", () => {
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.rpc_receive_po_items/i,
    )
    expect(migration).not.toContain(
      "app.po_receive_authorized",
    )
  })

  it("does not block receive status transitions explicitly", () => {
    expect(migration).not.toContain(
      "PURCHASE_RECEIVE_STATUS_DIRECT_UPDATE_FORBIDDEN",
    )
  })

  it("locks direct execution of private trigger functions", () => {
    expect(migration).toContain(
      "ON FUNCTION private.guard_purchase_order_approval_boundary()",
    )
    expect(migration).toContain(
      "ON FUNCTION private.guard_purchase_order_item_boundary()",
    )
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated, service_role",
    )
  })

  it("uses locked search paths on both trigger functions", () => {
    const matches = migration.match(
      /SET search_path TO ''/g,
    )
    expect(matches?.length).toBe(2)
  })
})
