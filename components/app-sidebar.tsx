"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Hexagon } from "lucide-react"

import { NAV_ITEMS } from "@/components/nav"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { ThemeSwitcher } from "@/components/theme-switcher"

export function AppSidebar({ email, role, employeeRole, orgName, allowedFeatures = [] }: any) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-black/40 backdrop-blur-[40px] shadow-[4px_0_24px_rgba(0,0,0,0.3)] text-white">
      <SidebarHeader className="pb-4">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-white/20 to-white/5 border border-white/20 shadow-lg backdrop-blur-xl">
            <Hexagon className="size-7 text-white drop-shadow-md" />
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden pl-1">
            <span className="text-xl font-black text-white tracking-tight leading-none pb-1 drop-shadow-md" suppressHydrationWarning>{orgName}</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-white/60 uppercase mt-0">Company OS</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {NAV_ITEMS.filter((item) => {
                if (role === "owner" || role === "admin" || employeeRole === "admin" || employeeRole === "executive") return true;
                if (item.isBasic) return true;
                if (allowedFeatures && allowedFeatures.includes(item.href)) return true;
                return false;
              }).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "relative overflow-hidden transition-all duration-300 ease-out h-11 px-3 rounded-xl group/btn",
                        active 
                          ? "bg-white/20 shadow-lg border border-white/20 font-bold text-white backdrop-blur-md" 
                          : "text-white/70 hover:text-white hover:bg-white/10 border border-transparent font-medium"
                      )}
                      render={<Link href={item.href} />}
                    >
                      <Icon className={cn("size-5 transition-transform duration-300", active ? "scale-110 drop-shadow-md" : "group-hover/btn:scale-110")} />
                      <span className={cn("tracking-wide", active && "drop-shadow-md")} suppressHydrationWarning>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4 flex flex-col gap-2">
        <div className="px-2"><ThemeSwitcher /></div>
        <div className="flex items-center gap-2 px-2 py-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg mx-2">
          <Avatar className="size-9 shrink-0 border border-white/20 shadow-sm">
            <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
              {(email ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden min-w-0">
            <span className="truncate text-[13px] font-bold text-white">{email ?? "—"}</span>
            <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase mt-0.5 truncate">{role}</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden shrink-0 ml-auto flex items-center">
            <form action="/auth/signout" method="post" className="m-0 p-0 flex">
              <Button type="submit" variant="ghost" size="icon" className="size-8 rounded-lg text-white/60 hover:bg-rose-500/30 hover:text-rose-100 transition-all" aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
