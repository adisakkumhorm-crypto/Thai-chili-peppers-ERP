import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const DIRECT_ISSUE_STOCK_CAPABILITY = {
  name: "inventory.stock.issue.direct",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_DIRECT_ISSUE_STOCK_PROVIDER = {
  id: "legacy-inventory-direct-issue",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [DIRECT_ISSUE_STOCK_CAPABILITY.name],
} satisfies ProviderDescriptor

const directIssueCapabilityRegistry =
  new CapabilityRegistry()

directIssueCapabilityRegistry.register(
  DIRECT_ISSUE_STOCK_CAPABILITY
)

const directIssueProviderResolver =
  new ProviderResolver(
    [LEGACY_DIRECT_ISSUE_STOCK_PROVIDER],
    {
      [DIRECT_ISSUE_STOCK_CAPABILITY.name]:
        LEGACY_DIRECT_ISSUE_STOCK_PROVIDER.id,
    }
  )

export type DirectIssueStockInput = Readonly<{
  productId: string
  locationId: string
  quantity: number
  referenceNo: string | null
  idempotencyKey: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type DirectIssueRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-3 direct-issue capability pilot.
 *
 * Provider resolution remains deliberately fail-closed.
 * Only the existing legacy DIRECT issue implementation is
 * allowed during I-3.
 */
export async function executeDirectIssueStock(
  client: DirectIssueRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectIssueStockInput
): Promise<{ error?: string }> {
  const capability =
    directIssueCapabilityRegistry.get(
      DIRECT_ISSUE_STOCK_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Direct issue capability is not registered",
    }
  }

  const provider =
    directIssueProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for direct stock issue",
    }
  }

  if (
    provider.id !==
    LEGACY_DIRECT_ISSUE_STOCK_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for direct stock issue",
    }
  }

  return executeLegacyDirectIssueStock(
    client,
    invocation,
    input
  )
}

/**
 * Legacy DIRECT issue provider adapter.
 *
 * rpc_issue_stock remains the business authority for:
 * - idempotency
 * - product and balance locking
 * - available-stock validation
 * - moving-average valuation
 * - transaction history
 *
 * Sales fulfillment is intentionally excluded from I-3.
 */
export async function executeLegacyDirectIssueStock(
  client: DirectIssueRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectIssueStockInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for direct stock issue",
    }
  }

  const { error } = await client.rpc(
    "rpc_issue_stock",
    {
      p_org_id: invocation.actor.orgId,
      p_mode: "DIRECT",
      p_quantity: input.quantity,
      p_idempotency_key: input.idempotencyKey,
      p_user_id: userId,
      p_product_id: input.productId,
      p_location_id: input.locationId,
      p_reference_no: input.referenceNo,
      p_sales_order_item_id: null,
    }
  )

  if (error) {
    return {
      error:
        error.message ||
        error.details ||
        "Unknown error",
    }
  }

  return {}
}
