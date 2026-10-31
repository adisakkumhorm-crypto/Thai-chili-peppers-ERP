import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  LEGACY_SALES_ORDER_CANCEL_PROVIDER,
  SALES_ORDER_CANCEL_CAPABILITY,
  executeLegacySalesOrderCancelReservation,
  executeSalesOrderCancelReservation,
  type SalesOrderCancelRpcClient,
} from "./sales-order-cancel-capability"

const invocation: CapabilityInvocationContext = {
  actor: {
    actorType: "human",
    actorId: "user-1",
    orgId: "org-1",
    userId: "user-1",
    membershipRole: "member",
    employeeRole: "staff",
    allowedFeatures: ["/sales"],
    timezone: "Asia/Bangkok",
  },
  correlationId: "corr-sales-cancel-1",
}

const input = {
  orderId: "11111111-1111-1111-1111-111111111111",
}

describe("sales order cancellation capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      SALES_ORDER_CANCEL_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.cancel.sales-order-reservation"
      )
    ).toEqual({
      name:
        "inventory.stock.cancel.sales-order-reservation",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves to the legacy cancellation provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_SALES_ORDER_CANCEL_PROVIDER],
      {
        [SALES_ORDER_CANCEL_CAPABILITY.name]:
          LEGACY_SALES_ORDER_CANCEL_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        SALES_ORDER_CANCEL_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_SALES_ORDER_CANCEL_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: SalesOrderCancelRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeSalesOrderCancelReservation(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_cancel_sales_order_reservation",
    ])
  })

  it("preserves the exact three-argument legacy RPC contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: SalesOrderCancelRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacySalesOrderCancelReservation(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_cancel_sales_order_reservation",
        args: {
          p_order_id:
            "11111111-1111-1111-1111-111111111111",
          p_user_id: "user-1",
          p_org_id: "org-1",
        },
      },
    ])
  })

  it("preserves legacy RPC error text", async () => {
    const client: SalesOrderCancelRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Allocation mismatch for product X",
          },
        }
      },
    }

    await expect(
      executeSalesOrderCancelReservation(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Allocation mismatch for product X",
    })
  })

  it("preserves RPC detail fallback", async () => {
    const client: SalesOrderCancelRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details:
              "Cancellation RPC detail",
          },
        }
      },
    }

    await expect(
      executeSalesOrderCancelReservation(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Cancellation RPC detail",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: SalesOrderCancelRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeSalesOrderCancelReservation(
        client,
        {
          ...invocation,
          actor: {
            ...invocation.actor,
            userId: null,
          },
        },
        input
      )

    expect(result).toEqual({
      error:
        "Authenticated user context is required for Sales Order cancellation",
    })

    expect(rpcCalled).toBe(false)
  })

  it("maps an unknown RPC failure to Unknown error", async () => {
    const client: SalesOrderCancelRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details: null,
          },
        }
      },
    }

    await expect(
      executeSalesOrderCancelReservation(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error: "Unknown error",
    })
  })
})
