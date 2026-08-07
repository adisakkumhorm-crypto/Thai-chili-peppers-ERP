import Link from "next/link"
import {
  Wallet,
  TrendingUp,
  Flame,
  Hourglass,
  Target,
  Repeat,
  FileWarning,
  Briefcase,
  CalendarClock,
  AlertTriangle,
  Package,
} from "lucide-react"

import { getDashboardData } from "@/lib/queries/dashboard"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatTHB, formatTHBWhole } from "@/lib/money"

export const dynamic = "force-dynamic"

function runwayLabel(months: number | null): { value: string; hint: string; tone: "default" | "positive" | "warning" | "negative" } {
  if (months === null) return { value: "∞", hint: "Revenue ≥ burn this month", tone: "positive" }
  const rounded = months.toFixed(1)
  if (months < 6) return { value: `${rounded} mo`, hint: "Runway under 6 months", tone: "negative" }
  if (months < 12) return { value: `${rounded} mo`, hint: "Keep an eye on burn", tone: "warning" }
  return { value: `${rounded} mo`, hint: "Healthy runway", tone: "default" }
}

export default async function DashboardPage() {
  const d = await getDashboardData()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your sales, cashflow, and inventory."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatTHB(d.monthlyRevenueSatang)}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="Open pipeline (Deals)"
          value={formatTHBWhole(d.pipelineSatang)}
          icon={Target}
          hint={`Weighted ${formatTHBWhole(d.weightedPipelineSatang)}`}
        />
        <StatCard
          label="Total Products"
          value={String(d.totalProductsCount)}
          icon={Package}
          hint={`${d.lowStockItems.length} items running low`}
          tone={d.lowStockItems.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Unpaid invoices"
          value={formatTHB(d.unpaidSatang)}
          icon={FileWarning}
          tone={d.overdueInvoiceCount > 0 ? "warning" : "default"}
          hint={`${d.unpaidInvoiceCount} open · ${d.overdueInvoiceCount} overdue`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> Inventory Alerts (Low Stock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.lowStockItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Stock is healthy"
                description="No products are currently running low."
                className="border-0 p-6"
              />
            ) : (
              <ul className="divide-y">
                {d.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/products/${item.id}`} className="hover:underline font-medium truncate text-primary">
                      {item.name}
                    </Link>
                    <Badge variant="destructive" className="shrink-0">
                      {item.stock_quantity} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" /> Action Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>Overdue invoices</span>
              <Badge variant={d.overdueInvoiceCount > 0 ? "destructive" : "secondary"}>
                {d.overdueInvoiceCount}
              </Badge>
            </div>
            <div className="rounded-md border">
              <div className="border-b px-3 py-2 text-sm font-medium">
                Follow-ups due today & overdue
              </div>
              {d.followUpsDueToday.length === 0 && d.overdueFollowUps.length === 0 ? (
                <p className="text-muted-foreground px-3 py-3 text-sm">All caught up — nice work.</p>
              ) : (
                <ul className="divide-y">
                  {d.overdueFollowUps.slice(0, 3).map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
                      <Badge variant="destructive" className="shrink-0 capitalize">
                        Overdue
                      </Badge>
                      <span className="truncate">{f.body ?? "Follow up"}</span>
                    </li>
                  ))}
                  {d.followUpsDueToday.slice(0, 3).map((f) => (
                        <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Badge variant="outline" className="shrink-0 capitalize">
                        Today
                      </Badge>
                      <span className="truncate">{f.body ?? "Follow up"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
