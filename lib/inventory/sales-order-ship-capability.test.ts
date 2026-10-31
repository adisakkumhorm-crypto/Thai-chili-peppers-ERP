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
  LEGACY_SALES_ORDER_SHIP_PROVIDER,
  SALES_ORDER_SHIP_CAPABILITY,
  executeLegacySalesOrderShip,
  executeSalesOrderShip,
  type SalesOrderShipRpcClient,
} from "./sales-order-ship-capability"

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
  correlationId: "corr-sales-ship-1",
}

const input = {
  orderId:
    "11111111-1111-1111-1111-111111111111",
}

describe("sales order shipment capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      SALES_ORDER_SHIP_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.ship.sales-order"
      )
    ).toEqual({
      name:
        "inventory.stock.ship.sales-order",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves to the legacy shipment provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_SALES_ORDER_SHIP_PROVIDER],
      {
        [SALES_ORDER_SHIP_CAPABILITY.name]:
          LEGACY_SALES_ORDER_SHIP_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        SALES_ORDER_SHIP_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_SALES_ORDER_SHIP_PROVIDER.id
    )
  })

  it("routes execution through the shipment capability seam", async () => {
    const calls: string[] = []

    const client: SalesOrderShipRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeSalesOrderShip(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_ship_sales_order",
    ])
  })

  it("preserves the exact four-argument legacy RPC contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: SalesOrderShipRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacySalesOrderShip(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_ship_sales_order",
        args: {
          p_order_id:
            "11111111-1111-1111-1111-111111111111",
          p_user_id: "user-1",
          p_org_id: "org-1",
          p_idempotency_key: null,
        },
      },
    ])
  })

  it("passes an explicit idempotency key unchanged", async () => {
    const calls: Array<
      Readonly<Record<string, unknown>>
    > = []

    const client: SalesOrderShipRpcClient = {
      async rpc(_functionName, args) {
        calls.push(args)
        return { error: null }
      },
    }

    await executeSalesOrderShip(
      client,
      invocation,
      {
        ...input,
        idempotencyKey:
          "client-request-123",
      }
    )

    expect(calls).toEqual([
      {
        p_order_id:
          "11111111-1111-1111-1111-111111111111",
        p_user_id: "user-1",
        p_org_id: "org-1",
        p_idempotency_key:
          "client-request-123",
      },
    ])
  })

  it("preserves legacy RPC error text", async () => {
    const client: SalesOrderShipRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Insufficient allocated stock for fulfillment",
          },
        }
      },
    }

    await expect(
      executeSalesOrderShip(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Insufficient allocated stock for fulfillment",
    })
  })

  it("preserves RPC detail fallback", async () => {
    const client: SalesOrderShipRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details:
              "Shipment RPC detail",
          },
        }
      },
    }

    await expect(
      executeSalesOrderShip(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Shipment RPC detail",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: SalesOrderShipRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeSalesOrderShip(
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
        "Authenticated user context is required for Sales Order shipment",
    })

    expect(rpcCalled).toBe(false)
  })

  it("maps an unknown RPC failure to Unknown error", async () => {
    const client: SalesOrderShipRpcClient = {
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
      executeSalesOrderShip(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error: "Unknown error",
    })
  })
})
