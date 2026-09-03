import { createClient } from "@/lib/supabase/server"
import { requireOrgContext } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { SalesOrderForm } from "../_components/sales-order-form"

export default async function NewSalesOrderPage() {
  const ctx = await requireOrgContext()
  const supabase = await createClient()
  const { data: channels } = await supabase.from("sales_channels").select("*").eq("org_id", ctx.orgId).eq("is_active", true)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="New Online Order" description="Create a new B2C sales order" />
      <div className="p-6 border rounded-md bg-card">
        <SalesOrderForm channels={channels || []} />
      </div>
    </div>
  )
}
