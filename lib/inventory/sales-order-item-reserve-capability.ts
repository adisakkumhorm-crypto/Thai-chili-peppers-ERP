import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const SALES_ORDER_ITEM_RESERVE_CAPABILITY = {
  name: "inventory.stock.reserve.sales-order-item",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER = {
  id: "legacy-inventory-sales-order-item-reserve",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [
    SALES_ORDER_ITEM_RESERVE_CAPABILITY.name,
  ],
} satisfies ProviderDescriptor

const salesOrderItemReserveCapabilityRegistry =
  new CapabilityRegistry()

salesOrderItemReserveCapabilityRegistry.register(
  SALES_ORDER_ITEM_RESERVE_CAPABILITY
)

const salesOrderItemReserveProviderResolver =
  new ProviderResolver(
    [LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER],
    {
      [SALES_ORDER_ITEM_RESERVE_CAPABILITY.name]:
        LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER.id,
    }
  )

export type SalesOrderItemReserveInput = Readonly<{
  orderId: string
  productId: string
  locationId: string
  quantity: number
  unitPrice: number
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type SalesOrderItemReserveRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

export async function executeSalesOrderItemReserve(
  client: SalesOrderItemReserveRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderItemReserveInput
): Promise<{ error?: string }> {
  const capability =
    salesOrderItemReserveCapabilityRegistry.get(
      SALES_ORDER_ITEM_RESERVE_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Sales Order item reservation capability is not registered",
    }
  }

  const provider =
    salesOrderItemReserveProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for Sales Order item reservation",
    }
  }

  if (
    provider.id !==
    LEGACY_SALES_ORDER_ITEM_RESERVE_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for Sales Order item reservation",
    }
  }

  return executeLegacySalesOrderItemReserve(
    client,
    invocation,
    input
  )
}

export async function executeLegacySalesOrderItemReserve(
  client: SalesOrderItemReserveRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderItemReserveInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for Sales Order item reservation",
    }
  }

  const { error } = await client.rpc(
    "rpc_reserve_so_item",
    {
      p_order_id: input.orderId,
      p_product_id: input.productId,
      p_location_id: input.locationId,
      p_quantity: input.quantity,
      p_unit_price: input.unitPrice,
      p_org_id: invocation.actor.orgId,
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
