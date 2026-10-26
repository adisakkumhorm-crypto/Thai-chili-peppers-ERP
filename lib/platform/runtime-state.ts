export type ProviderCutoverState =
  | "legacy"
  | "candidate"
  | "active"
  | "draining"
  | "disabled"

export type RuntimeHealth =
  | "healthy"
  | "degraded"
  | "open"
  | "recovering"

export const DEFAULT_PROVIDER_CUTOVER_STATE:
  ProviderCutoverState = "legacy"

export const DEFAULT_RUNTIME_HEALTH:
  RuntimeHealth = "healthy"
