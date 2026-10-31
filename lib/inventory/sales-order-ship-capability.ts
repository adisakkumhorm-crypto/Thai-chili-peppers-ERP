import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const SALES_ORDER_SHIP_CAPABILITY = {
  name: "inventory.stock.ship.sales-order",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_SALES_ORDER_SHIP_PROVIDER = {
  id: "legacy-inventory-sales-order-ship",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [SALES_ORDER_SHIP_CAPABILITY.name],
} satisfies ProviderDescriptor

const salesOrderShipCapabilityRegistry =
  new CapabilityRegistry()

salesOrderShipCapabilityRegistry.register(
  SALES_ORDER_SHIP_CAPABILITY
)

const salesOrderShipProviderResolver =
  new ProviderResolver(
    [LEGACY_SALES_ORDER_SHIP_PROVIDER],
    {
      [SALES_ORDER_SHIP_CAPABILITY.name]:
        LEGACY_SALES_ORDER_SHIP_PROVIDER.id,
    }
  )

export type SalesOrderShipInput = Readonly<{
  orderId: string
  idempotencyKey?: string | null
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type SalesOrderShipRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-8 Sales Order shipment capability.
 *
 * Resolution remains fail-closed. During I-8 only the existing
 * legacy Sales Order shipment provider may execute.
 */
export async function executeSalesOrderShip(
  client: SalesOrderShipRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderShipInput
): Promise<{ error?: string }> {
  const capability =
    salesOrderShipCapabilityRegistry.get(
      SALES_ORDER_SHIP_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Sales Order shipment capability is not registered",
    }
  }

  const provider =
    salesOrderShipProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for Sales Order shipment",
    }
  }

  if (
    provider.id !==
    LEGACY_SALES_ORDER_SHIP_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for Sales Order shipment",
    }
  }

  return executeLegacySalesOrderShip(
    client,
    invocation,
    input
  )
}

/**
 * Legacy Sales Order shipment provider adapter.
 *
 * rpc_ship_sales_order remains the shipment business authority.
 * rpc_issue_stock remains the stock mutation authority beneath it.
 */
export async function executeLegacySalesOrderShip(
  client: SalesOrderShipRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderShipInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for Sales Order shipment",
    }
  }

  const { error } = await client.rpc(
    "rpc_ship_sales_order",
    {
      p_order_id: input.orderId,
      p_user_id: userId,
      p_org_id: invocation.actor.orgId,
      p_idempotency_key:
        input.idempotencyKey ?? null,
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
