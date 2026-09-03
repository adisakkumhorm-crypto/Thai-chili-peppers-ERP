import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Pencil,
  ListChecks,
  Flag,
  Wallet,
  Package,
  Banknote,
  TrendingUp,
  ShoppingCart,
  CalendarClock,
  User,
  Building2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { formatTHB, formatTHBWhole } from "@/lib/money"
import { projectProfit } from "@/lib/metrics/projects"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { ProjectStatusBadge, TaskStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Enums } from "@/lib/types/database"
import { deadlineMeta, formatDate } from "../_lib/dates"
import { StatusSelect } from "../_components/status-select"
import { TaskToggle, MilestoneToggle } from "../_components/toggle-check"
import { AddTaskForm } from "../_components/add-task-form"
import { AddMilestoneForm } from "../_components/add-milestone-form"

export const dynamic = "force-dynamic"

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs font-medium">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  )
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireOrgContext()
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, status, deadline, budget_satang, owner, client_id, client:clients(name)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!project) notFound()

  const p = project as typeof project & {
    status: Enums<"project_status">
    client: { name: string } | null
  }

  const [{ data: tasksData }, { data: milestonesData }, { data: invoicesData }, { data: costsData }, { data: invTxData }, { data: timesheetsData }, { data: poItemsData }] =
    await Promise.all([
      supabase
        .from("project_tasks")
        .select("id, title, status, assignee, due_date, done")
        .eq("project_id", id)
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("milestones")
        .select("id, title, due_date, done")
        .eq("project_id", id)
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("status, amount_satang")
        .eq("project_id", id)
        .in("status", ["sent", "partially_paid", "paid", "overdue"]),
      supabase.from("costs").select("amount_satang").eq("project_id", id),
      supabase
        .from("inventory_transactions")
        .select("quantity, created_at, products(name, cost)")
        .eq("reference_no", p.name)
        .eq("transaction_type", "issue"),
      supabase
        .from("timesheets")
        .select("wage_amount")
        .eq("project_id", id)
        .eq("status", "completed"),
      supabase
        .from("purchase_order_items")
        .select("id, quantity, unit_price, purchase_orders!inner(id, po_number, expected_date, status), products(name)")
        .eq("project_id", id),
    ])

  const tasks = (tasksData ?? []) as Array<{
    id: string
    title: string
    status: Enums<"task_status">
    assignee: string | null
    due_date: string | null
    done: boolean
  }>
  const milestones = (milestonesData ?? []) as Array<{
    id: string
    title: string
    due_date: string | null
    done: boolean
  }>
  const invoices = (invoicesData ?? []) as Array<{
    status: Enums<"invoice_status">
    amount_satang: number
  }>
  const costs = (costsData ?? []) as Array<{ amount_satang: number }>

  const dl = deadlineMeta(p.deadline)
  const doneTasks = tasks.filter((t) => t.done).length
  const doneMilestones = milestones.filter((m) => m.done).length

  
  const poItems = (poItemsData ?? []) as any[]
  
  const invTxs = (invTxData ?? []) as any[]
  
  const poMaterialCost = poItems.reduce((acc, item) => acc + (item.quantity * item.unit_price * 100), 0)
  // inventory issues have negative quantity, so we multiply by -1
  const invMaterialCost = invTxs.reduce((acc, tx) => acc + (Math.abs(tx.quantity) * (tx.products?.cost || 0) * 100), 0)
  const materialCostSatang = poMaterialCost + invMaterialCost
  const timesheets = (timesheetsData ?? []) as any[]
  
  // timesheets store wage in Baht, convert to satang
  const laborCostSatang = timesheets.reduce((acc, t) => acc + ((t.wage_amount || 0) * 100), 0)
  const totalCostSatang = materialCostSatang + laborCostSatang
  const budgetSatang = p.budget_satang ?? 0
  const collectedSatang = invoices.filter(i => i.status === "paid" || i.status === "partially_paid").reduce((acc, i) => acc + i.amount_satang, 0)
  
  // Use collected if available, else budget for P/L projection
  const revenueBase = collectedSatang > 0 ? collectedSatang : budgetSatang
  const currentProfitSatang = revenueBase - totalCostSatang


  return (
    <div className="space-y-6">
      <PageHeader title={p.name} description={p.client?.name ?? "No client"}>
        <Button variant="outline" render={<Link href="/projects" />}>
          <ArrowLeft data-icon="inline-start" /> Back
        </Button>
        <Button variant="outline" render={<Link href={`/projects/${id}/edit`} />}>
          <Pencil data-icon="inline-start" /> Edit
        </Button>
      </PageHeader>

      {/* Overview + quick status change */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ProjectStatusBadge status={p.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Change status</span>
              <StatusSelect projectId={p.id} status={p.status} />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field icon={Building2} label="Client">
              {p.client?.name ?? "—"}
            </Field>
            <Field icon={CalendarClock} label="Deadline">
              {dl ? (
                <span
                  className={cn(
                    dl.tone === "danger" && "text-red-600 dark:text-red-400",
                    dl.tone === "warning" && "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {dl.label}
                  {dl.note ? (
                    <span className="block text-xs font-normal">{dl.note}</span>
                  ) : null}
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field icon={Wallet} label="Budget">
              {p.budget_satang != null ? formatTHBWhole(p.budget_satang) : "—"}
            </Field>
            <Field icon={User} label="Owner">
              {p.owner ?? "—"}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Profit (only when there are invoices or costs) */}
      
      {/* Fabrication Financial Dashboard */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Project Financials (กำไรขาดทุนปัจจุบัน)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">มูลค่างาน (Budget)</p>
              <p className="text-lg font-semibold">{formatTHB(budgetSatang)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-blue-600">ค่าวัสดุ (Material)</p>
              <p className="text-lg font-semibold text-blue-600">{formatTHB(materialCostSatang)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-purple-600">ค่าแรง (Labor)</p>
              <p className="text-lg font-semibold text-purple-600">{formatTHB(laborCostSatang)}</p>
              <p className="text-[10px] text-muted-foreground">ดึงจากเวลาเข้างาน (Timesheet)</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-red-600">รวมต้นทุน (Total Cost)</p>
              <p className="text-lg font-semibold text-red-600">{formatTHB(totalCostSatang)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-emerald-600">รับเงินแล้ว (Collected)</p>
              <p className="text-lg font-semibold text-emerald-600">{formatTHB(collectedSatang)}</p>
            </div>
            <div className="space-y-1 rounded-md bg-muted/50 p-2 border">
              <p className="text-xs font-medium">กำไรปัจจุบัน (P/L)</p>
              <p className={cn("text-xl font-bold", currentProfitSatang >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatTHB(currentProfitSatang)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Material Orders (POs) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="size-4" /> รายการสั่งซื้อวัสดุ (Material Orders)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {poItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No materials ordered yet"
              description="Purchase orders linked to this project will appear here."
              className="border-0 p-6"
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-3 font-medium">PO Number</th>
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 font-medium text-right">Qty</th>
                    <th className="p-3 font-medium text-right">Total (฿)</th>
                    <th className="p-3 font-medium text-center">Status</th>
                    <th className="p-3 font-medium">Expected Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {poItems.map(item => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <Link href={`/purchases/${item.purchase_orders.id}`} className="text-primary hover:underline font-medium">
                          {item.purchase_orders.po_number}
                        </Link>
                      </td>
                      <td className="p-3">{item.products?.name}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right font-medium">{(item.quantity * item.unit_price).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className="capitalize text-xs bg-muted px-2 py-1 rounded-full border">
                          {item.purchase_orders.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {item.purchase_orders.expected_date ? formatDate(item.purchase_orders.expected_date) : "TBD"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4" /> Tasks
            <span className="text-muted-foreground text-sm font-normal">
              {doneTasks}/{tasks.length} done
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddTaskForm projectId={p.id} />
          {tasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Break the project into tasks to track progress."
              className="border-0 p-6"
            />
          ) : (
            <ul className="divide-y rounded-md border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <TaskToggle
                    id={t.id}
                    projectId={p.id}
                    done={t.done}
                    label={`Mark "${t.title}" done`}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      t.done && "text-muted-foreground line-through"
                    )}
                  >
                    {t.title}
                  </span>
                  {t.assignee ? (
                    <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                      {t.assignee}
                    </span>
                  ) : null}
                  {t.due_date ? (
                    <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                      {formatDate(t.due_date)}
                    </span>
                  ) : null}
                  <TaskStatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="size-4" /> Milestones
            <span className="text-muted-foreground text-sm font-normal">
              {doneMilestones}/{milestones.length} done
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddMilestoneForm projectId={p.id} />
          {milestones.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No milestones yet"
              description="Add checkpoints to mark key deliverables."
              className="border-0 p-6"
            />
          ) : (
            <ul className="divide-y rounded-md border">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <MilestoneToggle
                    id={m.id}
                    projectId={p.id}
                    done={m.done}
                    label={`Mark "${m.title}" done`}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      m.done && "text-muted-foreground line-through"
                    )}
                  >
                    {m.title}
                  </span>
                  {m.due_date ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(m.due_date)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    
      {/* Issued Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="size-4" /> ประวัติการเบิกของหน้างาน (Issued Materials)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invTxs.length === 0 ? (
            <EmptyState
              icon={Package}
              title="ยังไม่มีการเบิกของ"
              description="เมื่อโฟร์แมนสแกน QR Code เบิกของจากคลัง ข้อมูลจะมาขึ้นที่นี่"
              className="border-0 p-6"
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-3 font-medium">วันที่เบิก (Date)</th>
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 font-medium text-right">Qty</th>
                    <th className="p-3 font-medium text-right">Cost (฿)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invTxs.map(tx => (
                    <tr key={tx.created_at} className="hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('th-TH', { timeZone: "Asia/Bangkok" })}</td>
                      <td className="p-3 font-medium">{tx.products?.name}</td>
                      <td className="p-3 text-right">{Math.abs(tx.quantity)}</td>
                      <td className="p-3 text-right text-red-600 font-medium">{(Math.abs(tx.quantity) * (tx.products?.cost || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
