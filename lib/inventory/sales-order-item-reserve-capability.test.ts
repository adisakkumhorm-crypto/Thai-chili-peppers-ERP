import {
  describe,
  expect,
  it,
} from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER,
  SALES_ORDER_ITEM_RESERVE_CAPABILITY,
  executeLegacySalesOrderItemReserve,
  executeSalesOrderItemReserve,
  type SalesOrderItemReserveRpcClient,
} from "./sales-order-item-reserve-capability"

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
  correlationId: "corr-sales-reserve-1",
}

const input = {
  orderId:
    "11111111-1111-1111-1111-111111111111",
  productId:
    "22222222-2222-2222-2222-222222222222",
  locationId:
    "33333333-3333-3333-3333-333333333333",
  quantity: 2,
  unitPrice: 125.5,
}

describe("sales order item reservation capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      SALES_ORDER_ITEM_RESERVE_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.reserve.sales-order-item"
      )
    ).toEqual({
      name:
        "inventory.stock.reserve.sales-order-item",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves to the legacy reservation provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER],
      {
        [SALES_ORDER_ITEM_RESERVE_CAPABILITY.name]:
          LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        SALES_ORDER_ITEM_RESERVE_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER.id
    )
  })

  it("routes execution through the reserve capability seam", async () => {
    const calls: string[] = []

    const client: SalesOrderItemReserveRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeSalesOrderItemReserve(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_reserve_so_item",
    ])
  })

  it("preserves the exact six-argument RPC contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: SalesOrderItemReserveRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacySalesOrderItemReserve(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_reserve_so_item",
        args: {
          p_order_id:
            "11111111-1111-1111-1111-111111111111",
          p_product_id:
            "22222222-2222-2222-2222-222222222222",
          p_location_id:
            "33333333-3333-3333-3333-333333333333",
          p_quantity: 2,
          p_unit_price: 125.5,
          p_org_id: "org-1",
        },
      },
    ])
  })

  it("does not forward correlation or idempotency metadata to the RPC", async () => {
    let args:
      | Readonly<Record<string, unknown>>
      | undefined

    const client: SalesOrderItemReserveRpcClient = {
      async rpc(_functionName, rpcArgs) {
        args = rpcArgs
        return { error: null }
      },
    }

    await executeSalesOrderItemReserve(
      client,
      {
        ...invocation,
        correlationId:
          "corr-observability-only",
        idempotencyKey:
          "must-not-be-forwarded",
      },
      input
    )

    expect(args).toEqual({
      p_order_id:
        "11111111-1111-1111-1111-111111111111",
      p_product_id:
        "22222222-2222-2222-2222-222222222222",
      p_location_id:
        "33333333-3333-3333-3333-333333333333",
      p_quantity: 2,
      p_unit_price: 125.5,
      p_org_id: "org-1",
    })

    expect(args).not.toHaveProperty(
      "p_idempotency_key"
    )
  })

  it("preserves legacy RPC error text", async () => {
    const client: SalesOrderItemReserveRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Not enough available stock at this location",
          },
        }
      },
    }

    await expect(
      executeSalesOrderItemReserve(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Not enough available stock at this location",
    })
  })

  it("preserves RPC detail fallback", async () => {
    const client: SalesOrderItemReserveRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details:
              "Reservation RPC detail",
          },
        }
      },
    }

    await expect(
      executeSalesOrderItemReserve(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Reservation RPC detail",
    })
  })

  it("maps an empty RPC failure to Unknown error", async () => {
    const client: SalesOrderItemReserveRpcClient = {
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
      executeSalesOrderItemReserve(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error: "Unknown error",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: SalesOrderItemReserveRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeSalesOrderItemReserve(
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
        "Authenticated user context is required for Sales Order item reservation",
    })

    expect(rpcCalled).toBe(false)
  })
})
