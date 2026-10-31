import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const PURCHASE_ORDER_RECEIVE_CAPABILITY = {
  name: "inventory.stock.receive.purchase-order",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER = {
  id: "legacy-inventory-purchase-order-receive",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [PURCHASE_ORDER_RECEIVE_CAPABILITY.name],
} satisfies ProviderDescriptor

const purchaseOrderReceiveCapabilityRegistry =
  new CapabilityRegistry()

purchaseOrderReceiveCapabilityRegistry.register(
  PURCHASE_ORDER_RECEIVE_CAPABILITY
)

const purchaseOrderReceiveProviderResolver =
  new ProviderResolver(
    [LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER],
    {
      [PURCHASE_ORDER_RECEIVE_CAPABILITY.name]:
        LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER.id,
    }
  )

export type PurchaseOrderReceiveItem = Readonly<{
  id: string
  product_id: string
  quantityToReceive: number
}>

export type PurchaseOrderReceiveInput = Readonly<{
  poId: string
  locationId: string
  items: ReadonlyArray<PurchaseOrderReceiveItem>
  idempotencyKey: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type PurchaseOrderReceiveRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-6 Purchase Order receive capability.
 *
 * Resolution remains deliberately fail-closed. During I-6 only the
 * existing legacy Purchase Order receive provider may execute.
 */
export async function executePurchaseOrderReceive(
  client: PurchaseOrderReceiveRpcClient,
  invocation: CapabilityInvocationContext,
  input: PurchaseOrderReceiveInput
): Promise<{ error?: string }> {
  const capability =
    purchaseOrderReceiveCapabilityRegistry.get(
      PURCHASE_ORDER_RECEIVE_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Purchase Order receive capability is not registered",
    }
  }

  const provider =
    purchaseOrderReceiveProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for Purchase Order receiving",
    }
  }

  if (
    provider.id !==
    LEGACY_PURCHASE_ORDER_RECEIVE_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for Purchase Order receiving",
    }
  }

  return executeLegacyPurchaseOrderReceive(
    client,
    invocation,
    input
  )
}

/**
 * Legacy Purchase Order receive provider adapter.
 *
 * rpc_receive_po_items remains the business authority for:
 * - organization and location validation
 * - authoritative PO-item product identity
 * - duplicate and quantity validation
 * - deterministic product / PO-item locking
 * - batch-safe idempotency
 * - moving-average valuation
 * - inventory balance and product aggregate mutation
 * - immutable inventory transaction history
 * - Purchase Order receipt status
 */
export async function executeLegacyPurchaseOrderReceive(
  client: PurchaseOrderReceiveRpcClient,
  invocation: CapabilityInvocationContext,
  input: PurchaseOrderReceiveInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for Purchase Order receiving",
    }
  }

  const { error } = await client.rpc(
    "rpc_receive_po_items",
    {
      p_po_id: input.poId,
      p_location_id: input.locationId,
      p_org_id: invocation.actor.orgId,
      p_user_id: userId,
      p_items: input.items,
      p_idempotency_key: input.idempotencyKey,
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
