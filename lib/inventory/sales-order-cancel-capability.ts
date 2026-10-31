import {
  CapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityInvocationContext,
} from "@/lib/platform/capability"
import {
  ProviderResolver,
  type ProviderDescriptor,
} from "@/lib/platform/provider-resolver"

export const SALES_ORDER_CANCEL_CAPABILITY = {
  name: "inventory.stock.cancel.sales-order-reservation",
  ownerModule: "inventory",
  kind: "command",
  risk: "high",
} satisfies CapabilityDefinition

export const LEGACY_SALES_ORDER_CANCEL_PROVIDER = {
  id: "legacy-inventory-sales-order-cancel-reservation",
  kind: "legacy",
  health: "healthy",
  cutoverState: "legacy",
  capabilities: [SALES_ORDER_CANCEL_CAPABILITY.name],
} satisfies ProviderDescriptor

const salesOrderCancelCapabilityRegistry =
  new CapabilityRegistry()

salesOrderCancelCapabilityRegistry.register(
  SALES_ORDER_CANCEL_CAPABILITY
)

const salesOrderCancelProviderResolver =
  new ProviderResolver(
    [LEGACY_SALES_ORDER_CANCEL_PROVIDER],
    {
      [SALES_ORDER_CANCEL_CAPABILITY.name]:
        LEGACY_SALES_ORDER_CANCEL_PROVIDER.id,
    }
  )

export type SalesOrderCancelInput = Readonly<{
  orderId: string
}>

type RpcError = Readonly<{
  message?: string | null
  details?: string | null
}>

export type SalesOrderCancelRpcClient = Readonly<{
  rpc: (
    functionName: string,
    args: Readonly<Record<string, unknown>>
  ) => Promise<{
    error: RpcError | null
  }>
}>

/**
 * Entry point for the I-7 sales-order reservation cancellation capability.
 *
 * Resolution remains deliberately fail-closed. During I-7 only the
 * existing legacy sales-order cancellation provider may execute.
 */
export async function executeSalesOrderCancelReservation(
  client: SalesOrderCancelRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderCancelInput
): Promise<{ error?: string }> {
  const capability =
    salesOrderCancelCapabilityRegistry.get(
      SALES_ORDER_CANCEL_CAPABILITY.name
    )

  if (!capability) {
    return {
      error:
        "Sales Order cancellation capability is not registered",
    }
  }

  const provider =
    salesOrderCancelProviderResolver.resolve(
      capability.name
    )

  if (!provider) {
    return {
      error:
        "No active provider available for Sales Order cancellation",
    }
  }

  if (
    provider.id !==
    LEGACY_SALES_ORDER_CANCEL_PROVIDER.id
  ) {
    return {
      error:
        "Unsupported provider for Sales Order cancellation",
    }
  }

  return executeLegacySalesOrderCancelReservation(
    client,
    invocation,
    input
  )
}

/**
 * Legacy sales-order cancellation provider adapter.
 *
 * rpc_cancel_sales_order_reservation remains the business authority for:
 * - organization-scoped order validation
 * - terminal-state rejection
 * - deterministic reservation locking
 * - strict reservation quantity/location validation
 * - exact allocation release
 * - atomic cancellation status transition
 */
export async function executeLegacySalesOrderCancelReservation(
  client: SalesOrderCancelRpcClient,
  invocation: CapabilityInvocationContext,
  input: SalesOrderCancelInput
): Promise<{ error?: string }> {
  const userId = invocation.actor.userId

  if (!userId) {
    return {
      error:
        "Authenticated user context is required for Sales Order cancellation",
    }
  }

  const { error } = await client.rpc(
    "rpc_cancel_sales_order_reservation",
    {
      p_order_id: input.orderId,
      p_user_id: userId,
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
