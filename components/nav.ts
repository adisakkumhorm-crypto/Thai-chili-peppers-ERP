import {
  LayoutDashboard,
  Users,
  Handshake,
  FolderKanban,
  Receipt,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Hide from members in the sidebar (page is also role-gated server-side). */
  ownerAdminOnly?: boolean
}

/**
 * Single source of truth for the app's primary navigation and routes.
 * Every module route is registered here so the sidebar stays in sync.
 */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Deals", href: "/deals", icon: Handshake },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Products", href: "/products", icon: Package },
  { title: "Finance", href: "/finance", icon: Receipt },
  { title: "Settings", href: "/settings", icon: Settings },
]
