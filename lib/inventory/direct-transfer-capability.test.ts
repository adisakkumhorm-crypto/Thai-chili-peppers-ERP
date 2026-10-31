import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  DIRECT_TRANSFER_STOCK_CAPABILITY,
  LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER,
  executeDirectTransferStock,
  executeLegacyDirectTransferStock,
  type DirectTransferRpcClient,
} from "./direct-transfer-capability"

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
  correlationId: "corr-transfer-1",
  idempotencyKey: "idem-transfer-1",
}

const input = {
  productId:
    "11111111-1111-1111-1111-111111111111",
  fromLocationId:
    "22222222-2222-2222-2222-222222222222",
  toLocationId:
    "33333333-3333-3333-3333-333333333333",
  quantity: 5,
  referenceNo: "TRANSFER-001",
  idempotencyKey: "idem-transfer-1",
}

describe("direct transfer stock capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      DIRECT_TRANSFER_STOCK_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.transfer.direct"
      )
    ).toEqual({
      name: "inventory.stock.transfer.direct",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves the pilot capability to the legacy provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER],
      {
        [DIRECT_TRANSFER_STOCK_CAPABILITY.name]:
          LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        DIRECT_TRANSFER_STOCK_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: DirectTransferRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeDirectTransferStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_transfer_stock",
    ])
  })

  it("preserves the existing direct-transfer RPC argument contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: DirectTransferRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacyDirectTransferStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_transfer_stock",
        args: {
          p_org_id: "org-1",
          p_product_id:
            "11111111-1111-1111-1111-111111111111",
          p_from_location_id:
            "22222222-2222-2222-2222-222222222222",
          p_to_location_id:
            "33333333-3333-3333-3333-333333333333",
          p_quantity: 5,
          p_reference_no:
            "TRANSFER-001",
          p_idempotency_key:
            "idem-transfer-1",
          p_user_id: "user-1",
        },
      },
    ])
  })

  it("preserves legacy RPC error text", async () => {
    const client: DirectTransferRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Insufficient available quantity in source location",
          },
        }
      },
    }

    await expect(
      executeDirectTransferStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Insufficient available quantity in source location",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: DirectTransferRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeDirectTransferStock(
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
        "Authenticated user context is required for direct stock transfer",
    })

    expect(rpcCalled).toBe(false)
  })
})
