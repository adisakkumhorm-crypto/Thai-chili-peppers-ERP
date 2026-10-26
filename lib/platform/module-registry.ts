/**
 * Logical module registry.
 *
 * This file describes ownership/routing boundaries only.
 * It does NOT enforce entitlement and does NOT change current application
 * behaviour during I-1.
 */

export type ModuleId =
  | "core"
  | "foundation"
  | "crm"
  | "project"
  | "inventory"
  | "procurement"
  | "sales"
  | "hr"
  | "finance"
  | "automation"

export type ModuleKind =
  | "platform"
  | "foundation"
  | "business"
  | "addon"

export type ModuleManifest = Readonly<{
  id: ModuleId
  name: string
  kind: ModuleKind
  dependencies: readonly ModuleId[]
  routes: readonly string[]
}>

export const MODULE_REGISTRY: Readonly<
  Record<ModuleId, ModuleManifest>
> = {
  core: {
    id: "core",
    name: "Core Platform",
    kind: "platform",
    dependencies: [],
    routes: [
      "/dashboard",
      "/my-requests",
      "/team",
      "/settings",
    ],
  },

  foundation: {
    id: "foundation",
    name: "Business Data Foundation",
    kind: "foundation",
    dependencies: ["core"],
    routes: ["/products"],
  },

  crm: {
    id: "crm",
    name: "CRM",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/clients", "/deals"],
  },

  project: {
    id: "project",
    name: "Project & Service",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/projects"],
  },

  inventory: {
    id: "inventory",
    name: "Inventory",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/inventory"],
  },

  procurement: {
    id: "procurement",
    name: "Procurement",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/suppliers", "/purchases"],
  },

  sales: {
    id: "sales",
    name: "Sales",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/sales"],
  },

  hr: {
    id: "hr",
    name: "HR & Workforce",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: ["/check-in", "/my-leave", "/hr"],
  },

  finance: {
    id: "finance",
    name: "Finance & Accounting",
    kind: "business",
    dependencies: ["core", "foundation"],
    routes: [
      "/finance",
      "/settings/accounting",
      "/settings/accounts",
      "/settings/taxes",
    ],
  },

  automation: {
    id: "automation",
    name: "Automation & AI Hub",
    kind: "addon",
    dependencies: ["core"],
    routes: [],
  },
}

export const MODULE_LIST: readonly ModuleManifest[] =
  Object.values(MODULE_REGISTRY)

/**
 * Resolve the logical owner of a route.
 * Longest route prefix wins so /settings/accounting belongs to Finance
 * while /settings itself remains Core.
 */
export function getModuleForRoute(
  pathname: string
): ModuleManifest | null {
  let winner: ModuleManifest | null = null
  let winnerLength = -1

  for (const moduleManifest of MODULE_LIST) {
    for (const route of moduleManifest.routes) {
      const matches =
        pathname === route ||
        pathname.startsWith(`${route}/`)

      if (matches && route.length > winnerLength) {
        winner = moduleManifest
        winnerLength = route.length
      }
    }
  }

  return winner
}

export function getModule(id: ModuleId): ModuleManifest {
  return MODULE_REGISTRY[id]
}
