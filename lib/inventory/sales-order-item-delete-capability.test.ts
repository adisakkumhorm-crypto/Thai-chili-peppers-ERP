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
  LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER,
  SALES_ORDER_ITEM_DELETE_CAPABILITY,
  executeLegacySalesOrderItemDelete,
  executeSalesOrderItemDelete,
  type SalesOrderItemDeleteRpcClient,
} from "./sales-order-item-delete-capability"

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
  correlationId: "corr-sales-delete-1",
}

const input = {
  itemId:
    "11111111-1111-1111-1111-111111111111",
}

describe("sales order item deletion capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      SALES_ORDER_ITEM_DELETE_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.delete.sales-order-item"
      )
    ).toEqual({
      name:
        "inventory.stock.delete.sales-order-item",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves to the legacy deletion provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER],
      {
        [SALES_ORDER_ITEM_DELETE_CAPABILITY.name]:
          LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        SALES_ORDER_ITEM_DELETE_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER.id
    )
  })

  it("routes execution through the delete capability seam", async () => {
    const calls: string[] = []

    const client: SalesOrderItemDeleteRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeSalesOrderItemDelete(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_delete_so_item",
    ])
  })

  it("preserves the exact two-argument RPC contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: SalesOrderItemDeleteRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacySalesOrderItemDelete(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_delete_so_item",
        args: {
          p_item_id:
            "11111111-1111-1111-1111-111111111111",
          p_org_id: "org-1",
        },
      },
    ])
  })

  it("does not forward correlation or idempotency metadata to the RPC", async () => {
    let args:
      | Readonly<Record<string, unknown>>
      | undefined

    const client: SalesOrderItemDeleteRpcClient = {
      async rpc(_functionName, rpcArgs) {
        args = rpcArgs
        return { error: null }
      },
    }

    await executeSalesOrderItemDelete(
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
      p_item_id:
        "11111111-1111-1111-1111-111111111111",
      p_org_id: "org-1",
    })

    expect(args).not.toHaveProperty(
      "p_idempotency_key"
    )

    expect(args).not.toHaveProperty(
      "correlationId"
    )
  })

  it("preserves legacy RPC error text", async () => {
    const client: SalesOrderItemDeleteRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Cannot modify items unless order is pending",
          },
        }
      },
    }

    await expect(
      executeSalesOrderItemDelete(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Cannot modify items unless order is pending",
    })
  })

  it("preserves RPC detail fallback", async () => {
    const client: SalesOrderItemDeleteRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details:
              "Delete RPC detail",
          },
        }
      },
    }

    await expect(
      executeSalesOrderItemDelete(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Delete RPC detail",
    })
  })

  it("maps an empty RPC failure to Unknown error", async () => {
    const client: SalesOrderItemDeleteRpcClient = {
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
      executeSalesOrderItemDelete(
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

    const client: SalesOrderItemDeleteRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeSalesOrderItemDelete(
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
        "Authenticated user context is required for Sales Order item deletion",
    })

    expect(rpcCalled).toBe(false)
  })
})
