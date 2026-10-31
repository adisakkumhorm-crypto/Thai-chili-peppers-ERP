import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  DIRECT_RECEIVE_STOCK_CAPABILITY,
  LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER,
  executeDirectReceiveStock,
  executeLegacyDirectReceiveStock,
  type DirectReceiveRpcClient,
} from "./direct-receive-capability"

const invocation: CapabilityInvocationContext = {
  actor: {
    actorType: "human",
    actorId: "user-1",
    orgId: "org-1",
    userId: "user-1",
    membershipRole: "member",
    employeeRole: "staff",
    allowedFeatures: ["/inventory"],
    timezone: "Asia/Bangkok",
  },
  correlationId: "corr-1",
  idempotencyKey: "idem-1",
}

const input = {
  productId:
    "11111111-1111-1111-1111-111111111111",
  locationId:
    "22222222-2222-2222-2222-222222222222",
  quantity: 5,
  unitCost: 12.5,
  referenceNo: "PO-001",
  batchQrCode: "LOT-001",
  idempotencyKey: "idem-1",
}

describe("direct receive stock capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      DIRECT_RECEIVE_STOCK_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.receive.direct"
      )
    ).toEqual({
      name: "inventory.stock.receive.direct",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves the pilot capability to the legacy provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER],
      {
        [DIRECT_RECEIVE_STOCK_CAPABILITY.name]:
          LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        DIRECT_RECEIVE_STOCK_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: DirectReceiveRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeDirectReceiveStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_receive_stock_direct",
    ])
  })

  it("preserves the existing RPC argument contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: DirectReceiveRpcClient = {
      async rpc(functionName, args) {
        calls.push({ functionName, args })
        return { error: null }
      },
    }

    await expect(
      executeLegacyDirectReceiveStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_receive_stock_direct",
        args: {
          p_org_id: "org-1",
          p_location_id:
            "22222222-2222-2222-2222-222222222222",
          p_product_id:
            "11111111-1111-1111-1111-111111111111",
          p_quantity: 5,
          p_unit_cost: 12.5,
          p_reference_no: "PO-001",
          p_batch_qr_code: "LOT-001",
          p_idempotency_key: "idem-1",
          p_user_id: "user-1",
        },
      },
    ])
  })

  it("preserves legacy RPC error text", async () => {
    const client: DirectReceiveRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "OPENING_INVENTORY_REQUIRED",
          },
        }
      },
    }

    await expect(
      executeDirectReceiveStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "OPENING_INVENTORY_REQUIRED",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: DirectReceiveRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeDirectReceiveStock(
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
        "Authenticated user context is required for direct stock receive",
    })

    expect(rpcCalled).toBe(false)
  })
})
