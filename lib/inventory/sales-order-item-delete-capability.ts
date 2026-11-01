import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const SALES_ORDER_ITEM_DELETE_CAPABILITY = {
  name: "inventory.stock.delete.sales-order-item",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER = {
  id: "legacy-inventory-sales-order-item-delete",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [
    SALES_ORDER_ITEM_DELETE_CAPABILITY.name,
  ],
} satisfies ProviderDescriptor

const salesOrderItemDeleteCapabilityRegistry =
  new CapabilityRegistry()

salesOrderItemDeleteCapabilityRegistry.register(
  SALES_ORDER_ITEM_DELETE_CAPABILITY
)

const salesOrderItemDeleteProviderResolver =
  new ProviderResolver(
    [LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER],
    {
      [SALES_ORDER_ITEM_DELETE_CAPABILITY.name]:
        LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER.id,
    }
  )

export type SalesOrderItemDeleteInput = Readonly<{
  itemId: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type SalesOrderItemDeleteRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

export async function executeSalesOrderItemDelete(
  client: SalesOrderItemDeleteRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderItemDeleteInput
): Promise<{ error?: string }> {
  const capability =
    salesOrderItemDeleteCapabilityRegistry.get(
      SALES_ORDER_ITEM_DELETE_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Sales Order item deletion capability is not registered",
    }
  }

  const provider =
    salesOrderItemDeleteProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for Sales Order item deletion",
    }
  }

  if (
    provider.id !==
    LEGACY_SALES_ORDER_ITEM_DELETE_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for Sales Order item deletion",
    }
  }

  return executeLegacySalesOrderItemDelete(
    client,
    invocation,
    input
  )
}

export async function executeLegacySalesOrderItemDelete(
  client: SalesOrderItemDeleteRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderItemDeleteInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for Sales Order item deletion",
    }
  }

  const { error } = await client.rpc(
    "rpc_delete_so_item",
    {
      p_item_id: input.itemId,
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
