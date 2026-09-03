import {
  Store,
  Warehouse,
  LayoutDashboard,
  Users,
  Camera,
  Calendar,
  Handshake,
  FolderKanban,
  Receipt,
  Banknote,
  Package,
  ShoppingCart,
  Truck,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  isBasic?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard (หน้าหลัก)", href: "/dashboard", icon: LayoutDashboard, isBasic: true },
  { title: "Check-in (ตอกบัตร)", href: "/check-in", icon: Camera, isBasic: true },
  { title: "Employee Portal", href: "/my-leave", icon: Calendar, isBasic: true },
  { title: "Clients (ลูกค้า)", href: "/clients", icon: Users },
  { title: "Deals (โอกาสการขาย)", href: "/deals", icon: Handshake },
  { title: "Projects (โครงการ)", href: "/projects", icon: FolderKanban },
  { title: "Inventory (คลังสินค้า)", href: "/inventory", icon: Warehouse },
  { title: "Products (สินค้า)", href: "/products", icon: Package },
  { title: "Sales (ขายหน้าร้าน)", href: "/sales", icon: Store },
  { title: "HR & Timesheet", href: "/hr", icon: Users },
  { title: "Payroll Preview", href: "/hr/payroll", icon: Banknote },
  { title: "Suppliers (ซัพพลายเออร์)", href: "/suppliers", icon: Truck },
  { title: "Purchases (จัดซื้อ)", href: "/purchases", icon: ShoppingCart },
  { title: "Finance (การเงิน)", href: "/finance", icon: Receipt },
  { title: "ทีมงานและสิทธิ์ (Team)", href: "/team", icon: ShieldCheck },
  { title: "Settings (ตั้งค่า)", href: "/settings", icon: Settings },
]
