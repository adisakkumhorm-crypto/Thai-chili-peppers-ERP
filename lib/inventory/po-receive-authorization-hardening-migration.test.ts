import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()

const migrationPath = join(
  root,
  "supabase/migrations/20261103130000_mod007_po_receive_authorization_hardening.sql"
)

const migration = readFileSync(migrationPath, "utf8")

describe("MOD-007 PO receive authorization hardening migration", () => {
  it("keeps the existing six-argument rpc_receive_po_items signature", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rpc_receive_po_items\s*\(\s*p_po_id uuid,\s*p_location_id uuid,\s*p_org_id uuid,\s*p_user_id uuid,\s*p_items jsonb,\s*p_idempotency_key text DEFAULT NULL::text\s*\)/i
    )
  })

  it("preserves SECURITY INVOKER instead of converting the RPC to SECURITY DEFINER", () => {
    expect(migration).not.toMatch(/\bSECURITY\s+DEFINER\b/i)
  })

  it("binds authenticated human receive actor to auth.uid()", () => {
    expect(migration).toMatch(
      /IF current_user = 'authenticated' THEN/
    )

    expect(migration).toMatch(
      /IF auth\.uid\(\) IS NULL THEN[\s\S]*PO_RECEIVE_AUTH_REQUIRED/
    )

    expect(migration).toMatch(
      /IF p_user_id IS DISTINCT FROM auth\.uid\(\) THEN[\s\S]*PO_RECEIVE_ACTOR_MISMATCH/
    )
  })

  it("requires explicit organization membership for authenticated human calls", () => {
    expect(migration).toMatch(
      /IF NOT private\.is_org_member\(p_org_id\) THEN[\s\S]*PO_RECEIVE_ORG_FORBIDDEN/
    )
  })

  it("preserves service_role as an explicit trusted backend path", () => {
    expect(migration).toMatch(
      /ELSIF current_user = 'service_role' THEN/
    )
  })

  it("rejects callers outside authenticated and service_role paths", () => {
    expect(migration).toMatch(
      /PO_RECEIVE_CALLER_FORBIDDEN/
    )
  })

  it("keeps execution ACL restricted to authenticated and service_role", () => {
    expect(migration).toMatch(
      /REVOKE ALL[\s\S]*ON FUNCTION public\.rpc_receive_po_items\([\s\S]*\)[\s\S]*FROM PUBLIC;/i
    )

    expect(migration).toMatch(
      /REVOKE ALL[\s\S]*ON FUNCTION public\.rpc_receive_po_items\([\s\S]*\)[\s\S]*FROM anon;/i
    )

    expect(migration).toMatch(
      /GRANT EXECUTE[\s\S]*ON FUNCTION public\.rpc_receive_po_items\([\s\S]*\)[\s\S]*TO authenticated, service_role;/i
    )
  })

  it("retains the receive business-contract markers", () => {
    const requiredMarkers = [
      "p_idempotency_key",
      "purchase_orders",
      "purchase_order_items",
      "inventory_balances",
      "inventory_transactions",
      "products",
      "received_quantity",
      "partially_received",
      "received",
      "average_cost",
      "total_value",
    ]

    for (const marker of requiredMarkers) {
      expect(migration).toContain(marker)
    }
  })

  it("keeps MOD-007 limited to authorization hardening", () => {
    expect(migration).toContain(
      "-- MOD-007 BEGIN RECEIVE AUTHORIZATION GUARD"
    )

    expect(migration).toContain(
      "-- MOD-007 END RECEIVE AUTHORIZATION GUARD"
    )

    expect(migration).not.toMatch(
      /\bALTER\s+TABLE\b[\s\S]*\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i
    )

    expect(migration).not.toMatch(
      /\bDROP\s+TABLE\b/i
    )
  })
})
