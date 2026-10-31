import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const DIRECT_TRANSFER_STOCK_CAPABILITY = {
  name: "inventory.stock.transfer.direct",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER = {
  id: "legacy-inventory-direct-transfer",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [DIRECT_TRANSFER_STOCK_CAPABILITY.name],
} satisfies ProviderDescriptor

const directTransferCapabilityRegistry =
  new CapabilityRegistry()

directTransferCapabilityRegistry.register(
  DIRECT_TRANSFER_STOCK_CAPABILITY
)

const directTransferProviderResolver =
  new ProviderResolver(
    [LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER],
    {
      [DIRECT_TRANSFER_STOCK_CAPABILITY.name]:
        LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER.id,
    }
  )

export type DirectTransferStockInput = Readonly<{
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  referenceNo: string | null
  idempotencyKey: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type DirectTransferRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-4 direct-transfer capability pilot.
 *
 * Resolution is deliberately fail-closed. During I-4 only the
 * existing legacy direct-transfer provider may execute.
 */
export async function executeDirectTransferStock(
  client: DirectTransferRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectTransferStockInput
): Promise<{ error?: string }> {
  const capability =
    directTransferCapabilityRegistry.get(
      DIRECT_TRANSFER_STOCK_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Direct transfer capability is not registered",
    }
  }

  const provider =
    directTransferProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for direct stock transfer",
    }
  }

  if (
    provider.id !==
    LEGACY_DIRECT_TRANSFER_STOCK_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for direct stock transfer",
    }
  }

  return executeLegacyDirectTransferStock(
    client,
    invocation,
    input
  )
}

/**
 * Legacy direct-transfer provider adapter.
 *
 * rpc_transfer_stock remains the business authority for:
 * - positive transfer quantity validation
 * - source/destination validation
 * - idempotency
 * - deterministic locking
 * - available-stock validation
 * - destination balance upsert
 * - product aggregate synchronization
 * - paired transfer transaction history
 */
export async function executeLegacyDirectTransferStock(
  client: DirectTransferRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectTransferStockInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for direct stock transfer",
    }
  }

  const { error } = await client.rpc(
    "rpc_transfer_stock",
    {
      p_org_id: invocation.actor.orgId,
      p_product_id: input.productId,
      p_from_location_id: input.fromLocationId,
      p_to_location_id: input.toLocationId,
      p_quantity: input.quantity,
      p_reference_no: input.referenceNo,
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
