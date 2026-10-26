import type { ActorContext } from "./actor-context"
import type { ModuleId } from "./module-registry"

export type CapabilityKind = "query" | "command"

export type CapabilityRisk =
  | "low"
  | "medium"
  | "high"
  | "critical"

export type CapabilityDefinition = Readonly<{
  name: string
  ownerModule: ModuleId
  kind: CapabilityKind
  risk: CapabilityRisk
}>

export type CapabilityInvocationContext = Readonly<{
  actor: ActorContext
  correlationId: string
  causationId?: string
  idempotencyKey?: string
}>

export class CapabilityRegistry {
  private readonly definitions =
    new Map<string, CapabilityDefinition>()

  register(definition: CapabilityDefinition): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(
        `Capability already registered: ${definition.name}`
      )
    }

    this.definitions.set(definition.name, definition)
  }

  get(name: string): CapabilityDefinition | null {
    return this.definitions.get(name) ?? null
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()]
  }
}
