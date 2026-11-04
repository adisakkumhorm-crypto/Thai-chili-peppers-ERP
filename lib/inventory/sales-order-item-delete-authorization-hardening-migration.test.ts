import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/" +
    "20261104120000_mod010_sales_order_item_delete_authorization_hardening.sql"
)

const readMigration = () =>
  fs.readFileSync(
    migrationPath,
    "utf8"
  )

const compact = (value: string) =>
  value
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()

describe(
  "MOD-010 sales-order item delete authorization hardening",
  () => {
    it("exists at the locked migration path", () => {
      expect(
        fs.existsSync(migrationPath)
      ).toBe(true)
    })

    it("preserves the exact two-argument RPC", () => {
      const sql = compact(
        readMigration()
      )

      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.rpc_delete_so_item\s*\(\s*p_item_id uuid\s*,\s*p_org_id uuid\s*\)/i
      )

      expect(sql).toMatch(
        /RETURNS void/i
      )

      expect(sql).not.toMatch(
        /\bp_user_id\b/i
      )
    })

    it("contains exactly one authorization guard", () => {
      const sql = readMigration()

      expect(
        sql.match(
          /MOD010_AUTH_GUARD_BEGIN:DELETE_SO_ITEM/g
        ) ?? []
      ).toHaveLength(1)

      expect(
        sql.match(
          /MOD010_AUTH_GUARD_END:DELETE_SO_ITEM/g
        ) ?? []
      ).toHaveLength(1)
    })

    it(
      "runs authorization before business logic",
      () => {
        const sql = readMigration()

        const guard =
          sql.indexOf(
            "MOD010_AUTH_GUARD_BEGIN:DELETE_SO_ITEM"
          )

        const business =
          sql.indexOf(
            "SELECT order_id"
          )

        expect(guard).toBeGreaterThan(-1)
        expect(business).toBeGreaterThan(-1)
        expect(guard).toBeLessThan(business)
      }
    )

    it(
      "requires auth uid and inline organization membership",
      () => {
        const sql = compact(
          readMigration()
        )

        expect(sql).toMatch(
          /current_user\s*=\s*'authenticated'/i
        )

        expect(sql).toMatch(
          /auth\.uid\(\)\s+IS\s+NULL/i
        )

        expect(sql).toContain(
          "SALES_ORDER_ITEM_DELETE_AUTH_REQUIRED"
        )

        expect(sql).toMatch(
          /FROM public\.memberships m WHERE m\.org_id = p_org_id AND m\.user_id = auth\.uid\(\)/i
        )

        expect(sql).toContain(
          "SALES_ORDER_ITEM_DELETE_ORG_FORBIDDEN"
        )

        expect(sql).not.toMatch(
          /private\.is_org_member/i
        )
      }
    )

    it(
      "preserves service-role compatibility and rejects other callers",
      () => {
        const sql = compact(
          readMigration()
        )

        expect(sql).toMatch(
          /ELSIF current_user = 'service_role' THEN NULL/i
        )

        expect(sql).toContain(
          "SALES_ORDER_ITEM_DELETE_CALLER_FORBIDDEN"
        )

        expect(
          sql.match(
            /ERRCODE = '42501'/g
          ) ?? []
        ).toHaveLength(3)
      }
    )

    it("preserves critical business behavior", () => {
      const sql = compact(
        readMigration()
      )

      expect(sql).toMatch(
        /SELECT order_id INTO v_order_id FROM public\.sales_order_items WHERE id = p_item_id AND org_id = p_org_id/i
      )

      expect(sql).toContain(
        "Cannot modify items unless order is pending"
      )

      expect(sql).toContain(
        "LEGACY_SALES_EXCEPTION"
      )

      expect(sql).toContain(
        "Invalid reservation quantity on sales order item"
      )

      expect(sql).toContain(
        "Allocation mismatch:"
      )

      expect(sql).toMatch(
        /UPDATE public\.inventory_balances SET allocated_quantity = allocated_quantity - v_item\.quantity/i
      )

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

    it("preserves function ownership and ACL", () => {
      const sql = compact(
        readMigration()
      )

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

    it("does not modify closed RPC definitions", () => {
      const sql = readMigration()

      const forbidden = [
        "rpc_reserve_so_item",
        "rpc_cancel_sales_order_reservation",
        "rpc_ship_sales_order",
        "rpc_adjust_stock",
        "rpc_issue_stock",
        "rpc_receive_stock_direct",
        "rpc_transfer_stock",
        "rpc_receive_po_items",
      ]

      for (const rpc of forbidden) {
        expect(sql).not.toMatch(
          new RegExp(
            `CREATE OR REPLACE FUNCTION public\\.${rpc}`,
            "i"
          )
        )
      }
    })

    it("defines only the target RPC", () => {
      const sql = readMigration()

      expect(
        sql.match(
          /CREATE OR REPLACE FUNCTION public\.rpc_delete_so_item/g
        ) ?? []
      ).toHaveLength(1)

      expect(
        sql.match(
          /CREATE OR REPLACE FUNCTION public\./g
        ) ?? []
      ).toHaveLength(1)
    })

    it("uses one outer migration transaction", () => {
      const sql =
        readMigration().trim()

      expect(
        sql.startsWith("BEGIN;")
      ).toBe(true)

      expect(
        sql.endsWith("COMMIT;")
      ).toBe(true)
    })
  }
)
