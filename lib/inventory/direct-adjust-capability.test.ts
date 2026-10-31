import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  DIRECT_ADJUST_STOCK_CAPABILITY,
  LEGACY_DIRECT_ADJUST_STOCK_PROVIDER,
  executeDirectAdjustStock,
  executeLegacyDirectAdjustStock,
  type DirectAdjustRpcClient,
} from "./direct-adjust-capability"

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
  correlationId: "corr-adjust-1",
  idempotencyKey: "idem-adjust-1",
}

const input = {
  productId:
    "11111111-1111-1111-1111-111111111111",
  locationId:
    "22222222-2222-2222-2222-222222222222",
  quantity: 5,
  unitCost: 12.5,
  referenceNo: "ADJUST-001",
  batchQrCode: "ADJUST-REASON",
  idempotencyKey: "idem-adjust-1",
}

describe("direct adjust stock capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      DIRECT_ADJUST_STOCK_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.adjust.direct"
      )
    ).toEqual({
      name: "inventory.stock.adjust.direct",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves the pilot capability to the legacy provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_DIRECT_ADJUST_STOCK_PROVIDER],
      {
        [DIRECT_ADJUST_STOCK_CAPABILITY.name]:
          LEGACY_DIRECT_ADJUST_STOCK_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        DIRECT_ADJUST_STOCK_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_DIRECT_ADJUST_STOCK_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: DirectAdjustRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeDirectAdjustStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_adjust_stock",
    ])
  })

  it("preserves the existing positive-adjust RPC argument contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: DirectAdjustRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacyDirectAdjustStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_adjust_stock",
        args: {
          p_org_id: "org-1",
          p_product_id:
            "11111111-1111-1111-1111-111111111111",
          p_location_id:
            "22222222-2222-2222-2222-222222222222",
          p_quantity: 5,
          p_unit_cost: 12.5,
          p_reference_no:
            "ADJUST-001",
          p_reason:
            "ADJUST-REASON",
          p_idempotency_key:
            "idem-adjust-1",
          p_user_id: "user-1",
        },
      },
    ])
  })

  it("preserves omitted unit cost for a negative adjustment", async () => {
    const calls: Array<
      Readonly<Record<string, unknown>>
    > = []

    const client: DirectAdjustRpcClient = {
      async rpc(_functionName, args) {
        calls.push(args)
        return { error: null }
      },
    }

    await executeLegacyDirectAdjustStock(
      client,
      invocation,
      {
        ...input,
        quantity: -1,
        unitCost: undefined,
      }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveProperty(
      "p_unit_cost",
      undefined
    )
  })

  it("preserves legacy RPC error text", async () => {
    const client: DirectAdjustRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Insufficient available stock for adjustment",
          },
        }
      },
    }

    await expect(
      executeDirectAdjustStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Insufficient available stock for adjustment",
    })
  })

  it("preserves legacy RPC error detail fallback", async () => {
    const client: DirectAdjustRpcClient = {
      async rpc() {
        return {
          error: {
            message: null,
            details: "adjust detail",
          },
        }
      },
    }

    await expect(
      executeDirectAdjustStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error: "adjust detail",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: DirectAdjustRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeDirectAdjustStock(
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
        "Authenticated user context is required for direct stock adjustment",
    })

    expect(rpcCalled).toBe(false)
  })
})
