import {
  readFileSync,
} from "node:fs"

import {
  resolve,
} from "node:path"

import {
  describe,
  expect,
  it,
} from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261104110000_mod009_sales_order_actor_authorization_hardening.sql"
)

const sql = readFileSync(
  migrationPath,
  "utf8"
)

function countMatches(
  value: string,
  pattern: RegExp
): number {
  return value.match(pattern)?.length ?? 0
}

function functionSection(
  functionName: string
): string {
  const start =
    sql.indexOf(
      `CREATE OR REPLACE FUNCTION public.${functionName}`
    )

  if (start < 0) {
    throw new Error(
      `Missing function ${functionName}`
    )
  }

  const next =
    sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.",
      start + 1
    )

  return next < 0
    ? sql.slice(start)
    : sql.slice(start, next)
}

describe(
  "MOD-009 Sales Order actor authorization migration",
  () => {
    it(
      "targets exactly Cancel and Ship RPC definitions",
      () => {
        expect(
          countMatches(
            sql,
            /CREATE OR REPLACE FUNCTION public\.rpc_/g
          )
        ).toBe(2)

        expect(sql).toContain(
          "CREATE OR REPLACE FUNCTION public.rpc_cancel_sales_order_reservation"
        )

        expect(sql).toContain(
          "CREATE OR REPLACE FUNCTION public.rpc_ship_sales_order"
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_delete_so_item/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_reserve_so_item/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_issue_stock/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_adjust_stock/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_receive_po_items/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_receive_stock_direct/
        )

        expect(sql).not.toMatch(
          /CREATE OR REPLACE FUNCTION public\.rpc_transfer_stock/
        )
      }
    )

    it(
      "keeps the locked function signatures",
      () => {
        expect(sql).toContain(
          "public.rpc_cancel_sales_order_reservation(p_order_id uuid, p_user_id uuid, p_org_id uuid)"
        )

        expect(sql).toContain(
          "public.rpc_ship_sales_order(p_order_id uuid, p_user_id uuid, p_org_id uuid, p_idempotency_key text DEFAULT NULL::text)"
        )
      }
    )

    it(
      "preserves SECURITY INVOKER and search_path contract",
      () => {
        expect(sql).not.toMatch(
          /SECURITY\s+DEFINER/i
        )

        expect(
          countMatches(
            sql,
            /SET search_path TO 'public', 'pg_temp'/g
          )
        ).toBe(2)
      }
    )

    it(
      "contains exactly two marked authorization guards",
      () => {
        expect(
          countMatches(
            sql,
            /MOD009_AUTH_GUARD_BEGIN:/g
          )
        ).toBe(2)

        expect(
          countMatches(
            sql,
            /MOD009_AUTH_GUARD_END:/g
          )
        ).toBe(2)

        expect(sql).toContain(
          "MOD009_AUTH_GUARD_BEGIN:CANCEL"
        )

        expect(sql).toContain(
          "MOD009_AUTH_GUARD_END:CANCEL"
        )

        expect(sql).toContain(
          "MOD009_AUTH_GUARD_BEGIN:SHIP"
        )

        expect(sql).toContain(
          "MOD009_AUTH_GUARD_END:SHIP"
        )
      }
    )

    it(
      "binds authenticated actors to auth.uid in both guards",
      () => {
        const cancel =
          functionSection(
            "rpc_cancel_sales_order_reservation"
          )

        const ship =
          functionSection(
            "rpc_ship_sales_order"
          )

        for (const section of [
          cancel,
          ship,
        ]) {
          expect(section).toContain(
            "current_user = 'authenticated'"
          )

          expect(section).toContain(
            "auth.uid() IS NULL"
          )

          expect(section).toContain(
            "p_user_id IS NULL"
          )

          expect(section).toContain(
            "p_user_id IS DISTINCT FROM auth.uid()"
          )

          expect(section).toContain(
            "current_user = 'service_role'"
          )
        }
      }
    )

    it(
      "uses inline public.memberships authorization and no private helper",
      () => {
        expect(
          countMatches(
            sql,
            /FROM public\.memberships m/g
          )
        ).toBe(2)

        expect(
          countMatches(
            sql,
            /m\.org_id = p_org_id/g
          )
        ).toBe(2)

        expect(
          countMatches(
            sql,
            /m\.user_id = auth\.uid\(\)/g
          )
        ).toBe(2)

        expect(sql).not.toContain(
          "private.is_org_member"
        )

        expect(sql).not.toMatch(
          /GRANT\s+USAGE\s+ON\s+SCHEMA\s+private/i
        )
      }
    )

    it(
      "locks Cancel authorization errors to SQLSTATE 42501",
      () => {
        const cancel =
          functionSection(
            "rpc_cancel_sales_order_reservation"
          )

        for (
          const code of [
            "SALES_ORDER_CANCEL_AUTH_REQUIRED",
            "SALES_ORDER_CANCEL_ACTOR_REQUIRED",
            "SALES_ORDER_CANCEL_ACTOR_MISMATCH",
            "SALES_ORDER_CANCEL_ORG_FORBIDDEN",
            "SALES_ORDER_CANCEL_CALLER_FORBIDDEN",
          ]
        ) {
          expect(cancel).toContain(code)
        }

        expect(
          countMatches(
            cancel,
            /ERRCODE = '42501'/g
          )
        ).toBe(5)
      }
    )

    it(
      "locks Ship authorization errors to SQLSTATE 42501",
      () => {
        const ship =
          functionSection(
            "rpc_ship_sales_order"
          )

        for (
          const code of [
            "SALES_ORDER_SHIP_AUTH_REQUIRED",
            "SALES_ORDER_SHIP_ACTOR_REQUIRED",
            "SALES_ORDER_SHIP_ACTOR_MISMATCH",
            "SALES_ORDER_SHIP_ORG_FORBIDDEN",
            "SALES_ORDER_SHIP_CALLER_FORBIDDEN",
          ]
        ) {
          expect(ship).toContain(code)
        }

        expect(
          countMatches(
            ship,
            /ERRCODE = '42501'/g
          )
        ).toBe(5)
      }
    )

    it(
      "preserves the existing shipment stock authority",
      () => {
        const ship =
          functionSection(
            "rpc_ship_sales_order"
          )

        expect(ship).toContain(
          "public.rpc_issue_stock("
        )

        expect(ship).toContain(
          "'ALLOCATED_FULFILLMENT'"
        )

        expect(ship).toContain(
          "p_user_id"
        )

        expect(ship).toContain(
          "'sales-shipped:'"
        )
      }
    )

    it(
      "preserves cancellation business mutation structure",
      () => {
        const cancel =
          functionSection(
            "rpc_cancel_sales_order_reservation"
          )

        expect(cancel).toContain(
          "UPDATE public.inventory_balances"
        )

        expect(cancel).toContain(
          "allocated_quantity - v_group.reserved_quantity"
        )

        expect(cancel).toContain(
          "status = 'cancelled'::sales_order_status"
        )
      }
    )

    it(
      "contains one outer transaction wrapper",
      () => {
        expect(
          countMatches(
            sql,
            /^BEGIN;$/gm
          )
        ).toBe(1)

        expect(
          countMatches(
            sql,
            /^COMMIT;$/gm
          )
        ).toBe(1)
      }
    )
  }
)
