import { cache } from "react"
import type { Enums } from "@/lib/types/database"

export type Role = Enums<"role_enum">

export type OrgContext = {
  userId: string
  email: string | null
  orgId: string
  orgName: string
  role: Role
}

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  // MOCKED FOR UI INSPECTION
  return {
    userId: "mock-user",
    email: "demo@boombignose.org",
    orgId: "mock-org",
    orgName: "My Workspace",
    role: "owner" as Role,
  }
})

export async function requireOrgContext(): Promise<OrgContext> {
  return (await getOrgContext())!
}

export function requireRole(ctx: OrgContext, allowed: Role[]): void {
  // bypass
}
