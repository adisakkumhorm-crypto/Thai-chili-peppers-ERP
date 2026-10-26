import type { ProviderCutoverState } from "./runtime-state"

export type ProviderKind =
  | "legacy"
  | "internal"
  | "connector"
  | "external"

export type ProviderHealth =
  | "healthy"
  | "degraded"
  | "unavailable"

export type ProviderDescriptor = Readonly<{
  id: string
  kind: ProviderKind
  health: ProviderHealth
  cutoverState: ProviderCutoverState
  capabilities: readonly string[]
}>

export type ProviderRoutingTable =
  Readonly<Record<string, string>>

export class ProviderResolver {
  private readonly providersById: ReadonlyMap<
    string,
    ProviderDescriptor
  >

  constructor(
    providers: readonly ProviderDescriptor[],
    private readonly routes: ProviderRoutingTable
  ) {
    const map = new Map<string, ProviderDescriptor>()

    for (const provider of providers) {
      if (map.has(provider.id)) {
        throw new Error(
          `Duplicate provider id: ${provider.id}`
        )
      }

      map.set(provider.id, provider)
    }

    this.providersById = map
  }

  resolve(
    capability: string,
    pinnedProviderId?: string
  ): ProviderDescriptor | null {
    if (pinnedProviderId) {
      return this.resolvePinned(
        capability,
        pinnedProviderId
      )
    }

    return this.resolveNewWork(capability)
  }

  private resolvePinned(
    capability: string,
    providerId: string
  ): ProviderDescriptor | null {
    const provider = this.providersById.get(providerId)

    if (!provider) return null
    if (!provider.capabilities.includes(capability)) return null
    if (provider.health === "unavailable") return null

    if (
      provider.cutoverState !== "legacy" &&
      provider.cutoverState !== "active" &&
      provider.cutoverState !== "draining"
    ) {
      return null
    }

    return provider
  }

  private resolveNewWork(
    capability: string
  ): ProviderDescriptor | null {
    const providerId = this.routes[capability]

    if (!providerId) return null

    const provider = this.providersById.get(providerId)

    if (!provider) return null
    if (!provider.capabilities.includes(capability)) return null
    if (provider.health === "unavailable") return null

    if (
      provider.cutoverState !== "legacy" &&
      provider.cutoverState !== "active"
    ) {
      return null
    }

    return provider
  }
}
