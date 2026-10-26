import type {
  EmployeeRole,
  OrgContext,
  Role,
} from "@/lib/auth"

import {
  normalizeAllowedFeatures,
  type CanonicalFeatureRoute,
} from "./feature-identity"

export type ActorType =
  | "human"
  | "ai"
  | "automation"
  | "api"
  | "system"

export type ActorContext = Readonly<{
  actorType: ActorType
  actorId: string
  orgId: string
  userId: string | null
  membershipRole: Role | null
  employeeRole: EmployeeRole | null
  allowedFeatures: readonly CanonicalFeatureRoute[]
  timezone: string
}>

/**
 * Adapter only.
 *
 * I-1C does not replace requireOrgContext().
 * Future capability calls can consume this neutral actor representation.
 */
export function humanActorFromOrgContext(
  ctx: OrgContext
): ActorContext {
  return {
    actorType: "human",
    actorId: ctx.userId,
    orgId: ctx.orgId,
    userId: ctx.userId,
    membershipRole: ctx.role,
    employeeRole: ctx.employeeRole,
    allowedFeatures: normalizeAllowedFeatures(ctx.allowedFeatures),
    timezone: ctx.timezone,
  }
}
