export type FeatureAccessIdentity = Readonly<{
  membershipRole: string | null | undefined
  employeeRole: string | null | undefined
}>

/**
 * Universal feature access is intentionally narrow.
 *
 * Executive is a business/employee role, not a global security bypass.
 * Executives still use explicit allowedFeatures unless another policy
 * grants them access.
 */
export function hasUniversalFeatureAccess(
  identity: FeatureAccessIdentity
): boolean {
  return (
    identity.membershipRole === "owner" ||
    identity.membershipRole === "admin" ||
    identity.employeeRole === "admin"
  )
}
