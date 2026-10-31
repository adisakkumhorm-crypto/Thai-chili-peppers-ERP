import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER,
  PURCHASE_ORDER_RECEIVE_CAPABILITY,
  executeLegacyPurchaseOrderReceive,
  executePurchaseOrderReceive,
  type PurchaseOrderReceiveRpcClient,
} from "./purchase-order-receive-capability"

const invocation: CapabilityInvocationContext = {
  actor: {
    actorType: "human",
    actorId: "user-1",
    orgId: "org-1",
    userId: "user-1",
    membershipRole: "member",
    employeeRole: "staff",
    allowedFeatures: ["/purchases"],
    timezone: "Asia/Bangkok",
  },
  correlationId: "corr-po-receive-1",
  idempotencyKey: "idem-po-receive-1",
}

const input = {
  poId: "11111111-1111-1111-1111-111111111111",
  locationId:
    "22222222-2222-2222-2222-222222222222",
  items: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      product_id:
        "44444444-4444-4444-4444-444444444444",
      quantityToReceive: 2,
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      product_id:
        "66666666-6666-6666-6666-666666666666",
      quantityToReceive: 3,
    },
  ],
  idempotencyKey: "idem-po-receive-1",
}

describe("purchase order receive capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      PURCHASE_ORDER_RECEIVE_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.receive.purchase-order"
      )
    ).toEqual({
      name: "inventory.stock.receive.purchase-order",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves the capability to the legacy provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER],
      {
        [PURCHASE_ORDER_RECEIVE_CAPABILITY.name]:
          LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        PURCHASE_ORDER_RECEIVE_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: PurchaseOrderReceiveRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executePurchaseOrderReceive(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_receive_po_items",
    ])
  })

  it("preserves the six-argument legacy RPC contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: PurchaseOrderReceiveRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacyPurchaseOrderReceive(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_receive_po_items",
        args: {
          p_po_id:
            "11111111-1111-1111-1111-111111111111",
          p_location_id:
            "22222222-2222-2222-2222-222222222222",
          p_org_id:
            "org-1",
          p_user_id:
            "user-1",
          p_items:
            input.items,
          p_idempotency_key:
            "idem-po-receive-1",
        },
      },
    ])
  })

  it("passes the complete multi-item batch unchanged", async () => {
    let rpcItems: unknown

    const client: PurchaseOrderReceiveRpcClient = {
      async rpc(_functionName, args) {
        rpcItems = args.p_items
        return { error: null }
      },
    }

    await executeLegacyPurchaseOrderReceive(
      client,
      invocation,
      input
    )

    expect(rpcItems).toEqual(input.items)
  })

  it("preserves legacy RPC error text", async () => {
    const client: PurchaseOrderReceiveRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Cannot receive 4 for item X. Remaining is 2",
          },
        }
      },
    }

    await expect(
      executePurchaseOrderReceive(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Cannot receive 4 for item X. Remaining is 2",
    })
  })

  it("preserves RPC error detail fallback", async () => {
    const client: PurchaseOrderReceiveRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details:
              "Purchase Order receive detail",
          },
        }
      },
    }

    await expect(
      executePurchaseOrderReceive(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Purchase Order receive detail",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: PurchaseOrderReceiveRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executePurchaseOrderReceive(
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
        "Authenticated user context is required for Purchase Order receiving",
    })

    expect(rpcCalled).toBe(false)
  })
})
