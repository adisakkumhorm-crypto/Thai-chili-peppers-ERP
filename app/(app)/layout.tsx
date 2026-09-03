import { requireOrgContext } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppBackground } from "@/components/app-background"
import { PresenceTracker } from "@/components/presence-tracker"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()

  return (
    <AppBackground>
      <PresenceTracker userId={ctx.userId} email={ctx.email} role={ctx.role} employeeRole={ctx.employeeRole} />
      <div className="relative w-full h-full flex flex-col overflow-hidden z-10 text-white">
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          <SidebarProvider>
            <AppSidebar email={ctx.email} role={ctx.role} employeeRole={ctx.employeeRole} orgName={ctx.orgName} allowedFeatures={ctx.allowedFeatures} />
            <SidebarInset className="bg-transparent border-none w-full relative">
              <header className="md:hidden bg-black/40 backdrop-blur-[40px] border-b border-white/10 sticky top-0 z-20 flex h-16 items-center gap-3 px-4 shadow-xl">
                <SidebarTrigger className="-ml-1 text-white" />
                <Separator orientation="vertical" className="mr-1 h-5 bg-white/20" />
                <span className="text-sm font-bold tracking-wide text-white drop-shadow-md">{ctx.orgName}</span>
              </header>
              <div className="flex flex-1 flex-col overflow-y-auto w-full h-full relative z-10 p-4 md:p-8">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </AppBackground>
  )
}
