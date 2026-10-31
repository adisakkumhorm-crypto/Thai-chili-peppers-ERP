import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const DIRECT_ADJUST_STOCK_CAPABILITY = {
  name: "inventory.stock.adjust.direct",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_DIRECT_ADJUST_STOCK_PROVIDER = {
  id: "legacy-inventory-direct-adjust",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [DIRECT_ADJUST_STOCK_CAPABILITY.name],
} satisfies ProviderDescriptor

const directAdjustCapabilityRegistry =
  new CapabilityRegistry()

directAdjustCapabilityRegistry.register(
  DIRECT_ADJUST_STOCK_CAPABILITY
)

const directAdjustProviderResolver =
  new ProviderResolver(
    [LEGACY_DIRECT_ADJUST_STOCK_PROVIDER],
    {
      [DIRECT_ADJUST_STOCK_CAPABILITY.name]:
        LEGACY_DIRECT_ADJUST_STOCK_PROVIDER.id,
    }
  )

export type DirectAdjustStockInput = Readonly<{
  productId: string
  locationId: string
  quantity: number
  unitCost: number | null | undefined
  referenceNo: string | null
  batchQrCode: string | null
  idempotencyKey: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type DirectAdjustRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-5 direct-adjust capability pilot.
 *
 * Resolution is deliberately fail-closed. During I-5 only the
 * existing legacy direct-adjust provider may execute.
 */
export async function executeDirectAdjustStock(
  client: DirectAdjustRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectAdjustStockInput
): Promise<{ error?: string }> {
  const capability =
    directAdjustCapabilityRegistry.get(
      DIRECT_ADJUST_STOCK_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Direct adjust capability is not registered",
    }
  }

  const provider =
    directAdjustProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for direct stock adjustment",
    }
  }

  if (
    provider.id !==
    LEGACY_DIRECT_ADJUST_STOCK_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for direct stock adjustment",
    }
  }

  return executeLegacyDirectAdjustStock(
    client,
    invocation,
    input
  )
}

/**
 * Legacy direct-adjust provider adapter.
 *
 * rpc_adjust_stock remains the business authority for:
 * - positive/negative adjustment validation
 * - moving-average valuation
 * - idempotency
 * - product-first locking
 * - available-stock / allocated-stock protection
 * - inventory balance mutation
 * - product aggregate synchronization
 * - immutable adjustment transaction history
 */
export async function executeLegacyDirectAdjustStock(
  client: DirectAdjustRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectAdjustStockInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for direct stock adjustment",
    }
  }

  const { error } = await client.rpc(
    "rpc_adjust_stock",
    {
      p_org_id: invocation.actor.orgId,
      p_product_id: input.productId,
      p_location_id: input.locationId,
      p_quantity: input.quantity,
      p_unit_cost: input.unitCost,
      p_reference_no: input.referenceNo,
      p_reason: input.batchQrCode,
      p_idempotency_key: input.idempotencyKey,
      p_user_id: userId,
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
