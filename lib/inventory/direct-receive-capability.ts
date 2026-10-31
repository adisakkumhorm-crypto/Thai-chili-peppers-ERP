import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const DIRECT_RECEIVE_STOCK_CAPABILITY = {
  name: "inventory.stock.receive.direct",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER = {
  id: "legacy-inventory-direct-receive",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [DIRECT_RECEIVE_STOCK_CAPABILITY.name],
} satisfies ProviderDescriptor

const directReceiveCapabilityRegistry =
  new CapabilityRegistry()

directReceiveCapabilityRegistry.register(
  DIRECT_RECEIVE_STOCK_CAPABILITY
)

const directReceiveProviderResolver =
  new ProviderResolver(
    [LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER],
    {
      [DIRECT_RECEIVE_STOCK_CAPABILITY.name]:
        LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER.id,
    }
  )

export type DirectReceiveStockInput = Readonly<{
  productId: string
  locationId: string
  quantity: number
  unitCost: number
  referenceNo: string | null
  batchQrCode: string | null
  idempotencyKey: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type DirectReceiveRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-2 direct-receive capability pilot.
 *
 * Resolution is deliberately fail-closed. New work must resolve
 * through the capability registry and provider resolver before
 * the existing legacy implementation is allowed to execute.
 */
export async function executeDirectReceiveStock(
  client: DirectReceiveRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectReceiveStockInput
): Promise<{ error?: string }> {
  const capability =
    directReceiveCapabilityRegistry.get(
      DIRECT_RECEIVE_STOCK_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Direct receive capability is not registered",
    }
  }

  const provider =
    directReceiveProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for direct stock receive",
    }
  }

  if (
    provider.id !==
    LEGACY_DIRECT_RECEIVE_STOCK_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for direct stock receive",
    }
  }

  return executeLegacyDirectReceiveStock(
    client,
    invocation,
    input
  )
}

/**
 * Legacy provider adapter.
 *
 * The database RPC remains the business authority:
 * valuation, stock balance, product aggregate,
 * idempotency and transaction history stay unchanged.
 */
export async function executeLegacyDirectReceiveStock(
  client: DirectReceiveRpcClient,
  invocation: CapabilityInvocationContext,
  input: DirectReceiveStockInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for direct stock receive",
    }
  }

  const { error } = await client.rpc(
    "rpc_receive_stock_direct",
    {
      p_org_id: invocation.actor.orgId,
      p_location_id: input.locationId,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_unit_cost: input.unitCost,
      p_reference_no: input.referenceNo,
      p_batch_qr_code: input.batchQrCode,
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
