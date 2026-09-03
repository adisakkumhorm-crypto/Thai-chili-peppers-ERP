"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Download, X, FileText, BarChart3, Scale } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  configToHref,
  configToQueryString,
  type ViewConfig,
} from "@/app/(app)/views/view-config"
import { SaveViewButton } from "@/app/(app)/views/save-view-button"
import {
  SavedViewsMenu,
  type SavedView,
} from "@/app/(app)/views/saved-views-menu"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
]

export function FinanceToolbar({
  status,
  savedViews,
}: {
  status: string
  savedViews: SavedView[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  const config: ViewConfig = status ? { status } : {}

  function onStatusChange(value: string) {
    const next: ViewConfig = value === "all" ? {} : { status: value }
    router.push(configToHref(pathname, next))
  }

  const invoicesQs = configToQueryString(config)
  const invoicesExportHref = invoicesQs
    ? `/finance/invoices/export?${invoicesQs}`
    : "/finance/invoices/export"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={status || "all"}
        onValueChange={(v) => onStatusChange(String(v))}
      >
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {status ? (
        <Button variant="ghost" size="sm" render={<Link href={pathname} />}>
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      ) : null}

      <div className="ms-auto flex flex-wrap items-center gap-2">
        <SavedViewsMenu
          views={savedViews}
          basePath={pathname}
          activeConfig={config}
        />
        <SaveViewButton module="finance" config={config} />
        
        <Button
          variant="outline"
          size="sm"
          render={<Link href={invoicesExportHref} />}
        >
          <Download className="w-4 h-4 mr-1" />
          Export invoices CSV
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/finance/costs/export" />}
        >
          <Download className="w-4 h-4 mr-1" />
          Export costs CSV
        </Button>

        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          render={<Link href="/finance/reports/income-statement" />}
        >
          <BarChart3 className="w-4 h-4 mr-1" />
          งบกำไรขาดทุน
        </Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          render={<Link href="/finance/reports/vat" />}
        >
          <FileText className="w-4 h-4 mr-1" />
          รายงานภาษี (ภ.พ.30)
        </Button>
        <Button
          size="sm"
          className="bg-rose-600 hover:bg-rose-700 text-white"
          render={<Link href="/finance/reports/wht" />}
        >
          <FileText className="w-4 h-4 mr-1" />
          รายงานหัก ณ ที่จ่าย
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          render={<Link href="/finance/reports/trial-balance" />}
        >
          <Scale className="w-4 h-4 mr-1" />
          งบทดลอง
        </Button>
      </div>
    </div>
  )
}
