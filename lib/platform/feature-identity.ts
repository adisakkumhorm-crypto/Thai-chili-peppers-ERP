/**
 * Feature identity compatibility layer.
 *
 * IMPORTANT:
 * - Module IDs and route permissions are intentionally separate concepts.
 * - Canonical feature permissions currently use route paths such as "/finance".
 * - Legacy join-request values such as "finance" are accepted only for
 *   compatibility and expanded conservatively.
 * - Unknown legacy values fail closed.
 */

export const CANONICAL_FEATURE_ROUTES = [
  "/dashboard",
  "/check-in",
  "/my-leave",
  "/my-requests",
  "/clients",
  "/deals",
  "/projects",
  "/inventory",
  "/products",
  "/sales",
  "/hr",
  "/hr/payroll",
  "/suppliers",
  "/purchases",
  "/finance",
  "/team",
  "/settings",
] as const

export type CanonicalFeatureRoute =
  (typeof CANONICAL_FEATURE_ROUTES)[number]

const CANONICAL_ROUTE_SET = new Set<string>(CANONICAL_FEATURE_ROUTES)

/**
 * Legacy groups reflect the labels that existed in the old Join Requests UI.
 * They are compatibility aliases only, not the future module model.
 */
export const LEGACY_FEATURE_GROUPS: Readonly<
  Record<string, readonly CanonicalFeatureRoute[]>
> = {
  dashboard: ["/dashboard"],
  projects: ["/projects", "/deals"],
  inventory: ["/inventory"],
  sales: ["/sales"],
  hr: ["/hr", "/hr/payroll"],
  finance: ["/finance", "/purchases"],
  settings: ["/settings", "/team"],
}

function cleanPath(value: string): string {
  const trimmed = value.trim()

  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.replace(/\/+$/, "")
  }

  return trimmed
}

/**
 * Expand one stored feature identity into canonical route permissions.
 * Unknown identities produce no permission.
 */
export function expandFeatureIdentity(
  value: string
): CanonicalFeatureRoute[] {
  const cleaned = cleanPath(value)

  if (!cleaned) return []

  const legacy = LEGACY_FEATURE_GROUPS[cleaned]
  if (legacy) return [...legacy]

  if (CANONICAL_ROUTE_SET.has(cleaned)) {
    return [cleaned as CanonicalFeatureRoute]
  }

  return []
}

/**
 * Convert mixed legacy/canonical values into a stable, de-duplicated route set.
 */
export function normalizeAllowedFeatures(
  values: readonly string[] | null | undefined
): CanonicalFeatureRoute[] {
  const result = new Set<CanonicalFeatureRoute>()

  for (const value of values ?? []) {
    for (const route of expandFeatureIdentity(value)) {
      result.add(route)
    }
  }

  return [...result]
}

/**
 * Compatibility access check for future adoption by the authorization seam.
 * This is NOT wired into production auth during I-1C.
 */
export function hasNormalizedFeatureAccess(
  values: readonly string[] | null | undefined,
  featurePath: string
): boolean {
  const requested = cleanPath(featurePath)

  return normalizeAllowedFeatures(values).some(
    (allowed) =>
      requested === allowed ||
      requested.startsWith(`${allowed}/`)
  )
}
