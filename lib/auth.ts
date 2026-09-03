import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/lib/types/database"

export type Role = Enums<"role_enum">

export type OrgContext = {
  userId: string
  email: string | null
  orgId: string
  orgName: string
  role: Role
  employeeRole: "admin" | "foreman" | "staff" | null
  allowedFeatures: string[]
  timezone: string
}

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const supabase = await createClient()

  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (!auth.user) {
    return null;
  }

  // In a real multi-tenant app, the user might select an org.
  // Here we just pick their first membership.
  const { data: memberships, error: memError } = await supabase
    .from("memberships")
    .select("role, organizations(id, name)")
    .eq("user_id", auth.user.id)
    .limit(1)
    .single()

  if (!memberships || !memberships.organizations) {
    return null;
  }

  const org = Array.isArray(memberships.organizations) 
    ? memberships.organizations[0] 
    : memberships.organizations

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("role, allowed_features" as any)
    .eq("user_id", auth.user.id)
    .eq("org_id", org.id)
    .limit(1)

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    orgId: org.id,
    orgName: org.name,
    role: memberships.role as Role,
    employeeRole: ((employees as any[])?.[0]?.role) ?? null,
    allowedFeatures: ((employees as any[])?.[0]?.allowed_features) ?? [],
    timezone: (org as any).timezone || "Asia/Bangkok",
  }
})

export async function requireOrgContext(): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/login")
  }

  const ctx = await getOrgContext()
  if (!ctx) {
    redirect("/no-workspace")
  }
  return ctx
}

export function requireRole(ctx: OrgContext, allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new Error("Unauthorized role")
  }
}

export function requireEmployeeRole(ctx: OrgContext, allowedRoles: ("admin" | "foreman" | "staff")[]): void {
  // System owners and admins bypass HR role checks
  if (ctx.role === "owner" || ctx.role === "admin") return;
  
  if (!ctx.employeeRole || !allowedRoles.includes(ctx.employeeRole)) {
    redirect("/unauthorized");
  }
}


export function requireFeatureAccess(ctx: OrgContext, featurePath: string): void {
  if (ctx.role === "owner" || ctx.role === "admin" || ctx.employeeRole === "admin" ) return;
  const basicPaths = ["/dashboard", "/check-in", "/my-leave"];
  if (basicPaths.some(p => featurePath === p || featurePath.startsWith(`${p}/`))) return;
  
  const hasAccess = ctx.allowedFeatures && ctx.allowedFeatures.some(allowedPath => 
    featurePath === allowedPath || featurePath.startsWith(`${allowedPath}/`)
  );

  if (!hasAccess) {
    throw new Error("Unauthorized feature access: " + featurePath);
  }
}

export function requireFeatureAccessOrRedirect(ctx: OrgContext, featurePath: string): void {
  try {
    requireFeatureAccess(ctx, featurePath);
  } catch (e) {
    redirect("/unauthorized");
  }
}
