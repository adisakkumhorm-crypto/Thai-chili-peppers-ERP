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

const MEMBERSHIP_ACCESS_ROLES = new Set([
  "owner",
  "admin",
  "member",
])

const EMPLOYEE_ACCESS_ROLES = new Set([
  "staff",
  "foreman",
  "manager",
  "executive",
  "admin",
])

export function canAssignMembershipRole(
  actorMembershipRole: string | null | undefined,
  requestedRole: string | null | undefined
): boolean {
  if (!requestedRole || !MEMBERSHIP_ACCESS_ROLES.has(requestedRole)) {
    return false
  }

  if (actorMembershipRole === "owner") return true

  return (
    actorMembershipRole === "admin" &&
    requestedRole === "member"
  )
}

export function canAssignEmployeeRole(
  actorMembershipRole: string | null | undefined,
  requestedRole: string | null | undefined
): boolean {
  if (!requestedRole || !EMPLOYEE_ACCESS_ROLES.has(requestedRole)) {
    return false
  }

  if (actorMembershipRole === "owner") return true

  return (
    actorMembershipRole === "admin" &&
    requestedRole !== "admin"
  )
}

export function canManageAccessTarget(
  actorMembershipRole: string | null | undefined,
  targetMembershipRole: string | null | undefined,
  targetEmployeeRole: string | null | undefined
): boolean {
  if (
    !targetMembershipRole ||
    !MEMBERSHIP_ACCESS_ROLES.has(targetMembershipRole)
  ) {
    return false
  }

  if (
    targetEmployeeRole != null &&
    !EMPLOYEE_ACCESS_ROLES.has(targetEmployeeRole)
  ) {
    return false
  }

  if (actorMembershipRole === "owner") return true
  if (actorMembershipRole !== "admin") return false

  return (
    targetMembershipRole === "member" &&
    targetEmployeeRole !== "admin"
  )
}
