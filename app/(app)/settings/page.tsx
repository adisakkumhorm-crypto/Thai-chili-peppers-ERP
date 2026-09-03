import Link from "next/link"
import { Wallet, Flame, PlugZap, ChevronRight, BookText, Percent, Lock } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { formatTHB, satangToBaht } from "@/lib/money"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SettingsForm } from "./_components/settings-form"
import { updateOrgSettings } from "./actions"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const canEdit = ctx.role === "owner" || ctx.role === "admin"

  // org_settings is a single row per org (org_id unique). May not exist yet.
  const { data: settings } = await supabase
    .from("org_settings")
    .select("cash_balance_satang, monthly_burn_satang")
    .eq("org_id", ctx.orgId)
    .maybeSingle()

  const cashSatang = settings?.cash_balance_satang ?? 0
  const burnSatang = settings?.monthly_burn_satang ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace finances and system settings."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Cash on hand"
          value={formatTHB(cashSatang)}
          icon={Wallet}
        />
        <StatCard
          label="Monthly burn override"
          value={burnSatang === null ? "Not set" : formatTHB(burnSatang)}
          icon={Flame}
          tone={burnSatang === null ? "default" : "warning"}
          hint={burnSatang === null ? "Using actual recorded costs" : undefined}
        />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>
              {canEdit
                ? "Update your workspace name and finances."
                : "Financial settings (view only)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <SettingsForm
                defaultOrgName={ctx.orgName}
                defaultCashBaht={satangToBaht(cashSatang)}
                defaultBurnBaht={burnSatang === null ? null : satangToBaht(burnSatang)}
                action={updateOrgSettings}
              />
            ) : (
              <div className="space-y-4">
                <Alert>
                  <Lock className="size-4" />
                  <AlertTitle>View only</AlertTitle>
                  <AlertDescription>
                    Only an owner or admin can change workspace settings.
                  </AlertDescription>
                </Alert>
                <dl className="divide-y text-sm">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Workspace name</dt>
                    <dd className="font-medium">{ctx.orgName}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Cash balance</dt>
                    <dd className="font-medium">{formatTHB(cashSatang)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">Monthly burn override</dt>
                    <dd className="font-medium">
                      {burnSatang === null ? "Not set" : formatTHB(burnSatang)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HR Settings</CardTitle>
            <CardDescription>
              การตั้งค่าบริษัทสำหรับระบบจัดการบุคคล (HR)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/settings/hr"
                className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
                <div>
                  <div className="font-medium">วันทำงาน & วันหยุด</div>
                  <div className="text-muted-foreground text-xs">
                    ตั้งค่า Working days, Public holidays
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>
            Connect Thai Chili Peppers to the tools you already use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/settings/accounts"
              className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <BookText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Chart of Accounts</p>
                <p className="text-muted-foreground truncate text-xs">
                  Manage ledger accounts (Assets, Liabilities, Equity, etc.)
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
            <Link
              href="/settings/accounting"
              className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <PlugZap className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Accounting sync</p>
                <p className="text-muted-foreground truncate text-xs">
                  Scaffold invoice syncing to FlowAccount, PEAK or Xero.
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
            <Link
              href="/settings/taxes"
              className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <Percent className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Tax Rates</p>
                <p className="text-muted-foreground truncate text-xs">
                  Configure VAT and Withholding Tax (WHT) rates.
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
