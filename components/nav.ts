import {
  LayoutDashboard,
  Users,
  Handshake,
  FolderKanban,
  Receipt,
  Package,
  ShoppingCart,
  Truck,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  ownerAdminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Deals", href: "/deals", icon: Handshake },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Products", href: "/products", icon: Package },
  { title: "Suppliers", href: "/suppliers", icon: Truck },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart },
  { title: "Finance", href: "/finance", icon: Receipt },
  { title: "Settings", href: "/settings", icon: Settings },
]
