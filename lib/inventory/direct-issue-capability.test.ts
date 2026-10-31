import { describe, expect, it } from "vitest"

import {
  CapabilityRegistry,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import { ProviderResolver } from "@/lib/platform/provider-resolver"

import {
  DIRECT_ISSUE_STOCK_CAPABILITY,
  LEGACY_DIRECT_ISSUE_STOCK_PROVIDER,
  executeDirectIssueStock,
  executeLegacyDirectIssueStock,
  type DirectIssueRpcClient,
} from "./direct-issue-capability"

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
  idempotencyKey: "idem-issue-1",
}

const input = {
  productId:
    "11111111-1111-1111-1111-111111111111",
  locationId:
    "22222222-2222-2222-2222-222222222222",
  quantity: 5,
  referenceNo: "ISSUE-001",
  idempotencyKey: "idem-issue-1",
}

describe("direct issue stock capability", () => {
  it("registers as a high-risk Inventory command", () => {
    const registry = new CapabilityRegistry()

    registry.register(
      DIRECT_ISSUE_STOCK_CAPABILITY
    )

    expect(
      registry.get(
        "inventory.stock.issue.direct"
      )
    ).toEqual({
      name: "inventory.stock.issue.direct",
      ownerModule: "inventory",
      kind: "command",
      risk: "high",
    })
  })

  it("resolves the pilot capability to the legacy provider", () => {
    const resolver = new ProviderResolver(
      [LEGACY_DIRECT_ISSUE_STOCK_PROVIDER],
      {
        [DIRECT_ISSUE_STOCK_CAPABILITY.name]:
          LEGACY_DIRECT_ISSUE_STOCK_PROVIDER.id,
      }
    )

    expect(
      resolver.resolve(
        DIRECT_ISSUE_STOCK_CAPABILITY.name
      )?.id
    ).toBe(
      LEGACY_DIRECT_ISSUE_STOCK_PROVIDER.id
    )
  })

  it("routes execution through the capability seam", async () => {
    const calls: string[] = []

    const client: DirectIssueRpcClient = {
      async rpc(functionName) {
        calls.push(functionName)
        return { error: null }
      },
    }

    await expect(
      executeDirectIssueStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      "rpc_issue_stock",
    ])
  })

  it("preserves the existing DIRECT RPC argument contract", async () => {
    const calls: Array<{
      functionName: string
      args: Readonly<Record<string, unknown>>
    }> = []

    const client: DirectIssueRpcClient = {
      async rpc(functionName, args) {
        calls.push({
          functionName,
          args,
        })

        return { error: null }
      },
    }

    await expect(
      executeLegacyDirectIssueStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({})

    expect(calls).toEqual([
      {
        functionName:
          "rpc_issue_stock",
        args: {
          p_org_id: "org-1",
          p_mode: "DIRECT",
          p_quantity: 5,
          p_idempotency_key:
            "idem-issue-1",
          p_user_id: "user-1",
          p_product_id:
            "11111111-1111-1111-1111-111111111111",
          p_location_id:
            "22222222-2222-2222-2222-222222222222",
          p_reference_no:
            "ISSUE-001",
          p_sales_order_item_id: null,
        },
      },
    ])
  })

  it("preserves legacy RPC error text", async () => {
    const client: DirectIssueRpcClient = {
      async rpc() {
        return {
          error: {
            message:
              "Insufficient available stock for DIRECT issue",
          },
        }
      },
    }

    await expect(
      executeDirectIssueStock(
        client,
        invocation,
        input
      )
    ).resolves.toEqual({
      error:
        "Insufficient available stock for DIRECT issue",
    })
  })

  it("fails closed without an authenticated user", async () => {
    let rpcCalled = false

    const client: DirectIssueRpcClient = {
      async rpc() {
        rpcCalled = true
        return { error: null }
      },
    }

    const result =
      await executeDirectIssueStock(
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
        "Authenticated user context is required for direct stock issue",
    })

    expect(rpcCalled).toBe(false)
  })
})
