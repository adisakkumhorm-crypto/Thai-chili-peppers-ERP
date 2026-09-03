import Link from "next/link"
import { Package, AlertTriangle, Building2, Store, DollarSign, HardHat, ArrowRight, SlidersHorizontal, TrendingUp, Target, FileWarning, CheckCircle2 } from "lucide-react"
import { requireOrgContext } from "@/lib/auth"
import { formatTHB } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { getDashboardData } from "@/lib/queries/dashboard"
import { LiveUsersWidget } from "@/components/live-users-widget"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const d = await getDashboardData()
  const totalRevenue = d.monthlyRevenueSatang + d.pipelineSatang

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full w-full max-w-[1400px] mx-auto text-white">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Analytics Dashboard</h1>
            <p className="text-white/70 mt-1 text-sm font-medium drop-shadow-sm">Overview of your business metrics and system status.</p>
          </div>
          <Badge variant="outline" className="w-fit bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 shadow-lg backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse inline-block shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Live Data Connected
          </Badge>
        </div>

        {/* Hero KPI */}
        <Card className="overflow-hidden relative border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] bg-black/40 backdrop-blur-[40px]">
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 relative z-10">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/20 shadow-xl shrink-0 backdrop-blur-md">
              <DollarSign className="size-8 text-blue-300 drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-white/70 uppercase tracking-wider mb-1">Total Expected Revenue</p>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
                {formatTHB(totalRevenue)}
              </h2>
              <p className="text-sm text-white/60 mt-2 font-medium">
                Monthly Revenue + Open Pipeline
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard 
            title="Open Pipeline" 
            value={formatTHB(d.pipelineSatang)} 
            subtitle="Pending deals" 
            icon={Target} 
          />
          <KpiCard 
            title="Monthly Revenue" 
            value={formatTHB(d.monthlyRevenueSatang)} 
            subtitle="Received this month" 
            icon={TrendingUp} 
          />
          <KpiCard 
            title="Unpaid Invoices" 
            value={formatTHB(d.unpaidSatang)} 
            subtitle={`${d.unpaidInvoiceCount} pending (${d.overdueInvoiceCount} overdue)`} 
            icon={FileWarning} 
            destructive={d.overdueInvoiceCount > 0}
          />
        </div>

        {/* Alerts & Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AlertsCard items={d.lowStockItems} />
          <FollowUpsCard items={[...d.overdueFollowUps, ...d.followUpsDueToday]} />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full xl:w-[320px] shrink-0 space-y-6">
        <Card>
          <CardHeader className="pb-4 border-b border-white/10 bg-white/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <SlidersHorizontal className="size-4 text-white/70" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-5 space-y-6">
              <StatusSlider 
                label="Pipeline Health" 
                value={d.pipelineSatang > 0 ? "Good" : "Low"} 
                percent={d.pipelineSatang > 0 ? 85 : 30} 
              />
              <StatusSlider 
                label="Cashflow State" 
                value={d.monthlyRevenueSatang > (d.monthlyBurnSatang || 0) ? "Positive" : "Deficit"} 
                percent={Math.min(100, Math.max(10, (d.monthlyRevenueSatang / (d.monthlyBurnSatang || 1)) * 100))} 
              />
              <StatusSlider 
                label="Stock Level" 
                value={d.lowStockItems.length > 5 ? "Warning" : "Optimal"} 
                percent={d.lowStockItems.length > 5 ? 40 : 90} 
              />
              <StatusSlider 
                label="Receivables" 
                value={d.overdueInvoiceCount > 0 ? "Action Required" : "Clear"} 
                percent={d.overdueInvoiceCount > 0 ? 60 : 100} 
              />
            </div>
            <div className="h-px w-full bg-white/10" />
            <div className="p-5 space-y-4">
              <StatusToggle label="Live DB Connection" active={true} />
              <StatusToggle label="RLS Security" active={true} />
              <StatusToggle label="Real-time Alerts" active={d.overdueInvoiceCount > 0 || d.lowStockItems.length > 0} />
            </div>
          </CardContent>
        </Card>

        <LiveUsersWidget />
      </div>
    </div>
  )
}

function KpiCard({ title, value, subtitle, icon: Icon, destructive = false }: any) {
  return (
    <Card className={`transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:bg-black/50 ${destructive ? 'border-rose-500/30 bg-rose-500/10' : ''}`}>
      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-bold text-white/70 drop-shadow-sm">
          {title}
        </CardTitle>
        <Icon className={`size-4 drop-shadow-md ${destructive ? 'text-rose-400' : 'text-white/50'}`} />
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="text-2xl font-black tracking-tight text-white drop-shadow-md">{value}</div>
        <p className={`text-xs mt-1 font-medium drop-shadow-sm ${destructive ? 'text-rose-400' : 'text-white/60'}`}>
          {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}

function AlertsCard({ items }: { items: any[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="p-5 border-b border-white/10 flex flex-row items-center justify-between space-y-0 bg-white/5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-orange-400 drop-shadow-md" />
          <CardTitle className="text-sm font-bold text-white drop-shadow-sm">Low Stock Alerts</CardTitle>
        </div>
        <Link href="/inventory" className="text-xs font-bold text-white/60 hover:text-white flex items-center transition-colors">
          View All <ArrowRight className="size-3 ml-1" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {items.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-sm font-medium text-white/60">
            <CheckCircle2 className="size-8 mb-2 text-emerald-400/50" />
            Stock levels are optimal
          </div>
        ) : (
          <div className="divide-y divide-white/10 overflow-y-auto" style={{ maxHeight: '250px' }}>
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/10 transition-colors">
                <Link href={`/products/${item.id}`} className="text-sm font-bold text-white hover:underline truncate mr-4">
                  {item.name}
                </Link>
                <Badge variant="secondary" className="shrink-0 text-orange-200 bg-orange-500/20 font-bold border-orange-500/30">
                  {item.stock_quantity} left
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FollowUpsCard({ items }: { items: any[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="p-5 border-b border-white/10 flex flex-row items-center justify-between space-y-0 bg-white/5">
        <div className="flex items-center gap-2">
          <HardHat className="size-4 text-blue-400 drop-shadow-md" />
          <CardTitle className="text-sm font-bold text-white drop-shadow-sm">Tasks & Follow-ups</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {items.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-sm font-medium text-white/60">
            <CheckCircle2 className="size-8 mb-2 text-blue-400/50" />
            No pending tasks
          </div>
        ) : (
          <div className="divide-y divide-white/10 overflow-y-auto" style={{ maxHeight: '250px' }}>
            {items.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 p-4 hover:bg-white/10 transition-colors">
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase font-bold border-white/20 text-white/80 bg-white/5">Due</Badge>
                <span className="text-sm font-bold text-white truncate drop-shadow-sm">{f.body || "Follow up"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusSlider({ label, value, percent }: { label: string, value: string, percent: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-bold text-white drop-shadow-sm">{label}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 bg-white/10 border border-white/20 px-2 py-0.5 rounded shadow-sm">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
        <div className="h-full bg-white/80 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function StatusToggle({ label, active }: { label: string, active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold text-white/70 drop-shadow-sm">{label}</span>
      <div className="flex items-center">
        {active ? (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 drop-shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Active
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-white/40">
            <span className="h-2 w-2 rounded-full bg-white/20"></span>
            Inactive
          </div>
        )}
      </div>
    </div>
  )
}
