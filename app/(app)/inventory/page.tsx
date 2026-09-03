import Link from "next/link"
import { Package, MapPin, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireOrgContext, requireFeatureAccessOrRedirect } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { formatTHB } from "@/lib/money"
import { TransactionDialog } from "./_components/transaction-dialog"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
  const ctx = await requireOrgContext()
  requireFeatureAccessOrRedirect(ctx, "/inventory")
  const supabase = await createClient()

  // Fetch locations
  const { data: locations } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("org_id", ctx.orgId)
    .order("name")

  // Fetch balances with product info
  // Fetch active projects for issuing
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name")
    .in("status", ["not_started", "in_progress"])
    .order("name")

  const projects = projectsData ?? []

  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("*, products(*), inventory_locations(name)")
    .eq("org_id", ctx.orgId)
    .order("product_id")

  const locs = locations ?? []
  const bals = balances ?? []

  // Group balances by location
  const balancesByLoc = locs.map(loc => {
    return {
      ...loc,
      items: bals.filter(b => b.location_id === loc.id)
    }
  })

  const totalValue = bals.reduce((acc, b) => acc + (b.on_hand_quantity * (b.products as any).cost), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Control" description="Manage multi-warehouse stock and QR operations">
        <Button variant="outline">
          <ArrowRightLeft data-icon="inline-start" /> Transfer
        </Button>
        <Button variant="default">
          <Plus data-icon="inline-start" /> New Transaction
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTHB(totalValue)}</div>
            <p className="text-xs text-muted-foreground">Based on product average cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Warehouses</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locs.length} Locations</div>
            <p className="text-xs text-muted-foreground">Ready for QR scanning</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {balancesByLoc.map(loc => (
          <Card key={loc.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="size-5 text-primary" /> {loc.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{loc.description}</p>
                </div>
                <Badge variant={loc.is_active ? "default" : "secondary"}>
                  {loc.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loc.items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No items in this location"
                  description="Receive goods via PO or transfer from another warehouse."
                  className="py-12 border-0"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10 text-left">
                        <th className="p-4 font-medium">Product / SKU</th>
                        <th className="p-4 font-medium text-center">On Hand (ในคลัง)</th>
                        <th className="p-4 font-medium text-center text-amber-600">Allocated (จอง)</th>
                        <th className="p-4 font-medium text-center text-emerald-600">Available (พร้อมใช้)</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loc.items.map(item => {
                        const p = item.products as any
                        const available = item.on_hand_quantity - item.allocated_quantity
                        const isLowStock = available <= p.min_stock
                        
                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4">
                              <div className="font-medium text-base">{p.name}</div>
                              <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
                                <span className="bg-muted px-1.5 py-0.5 rounded border">{p.sku || 'No SKU'}</span>
                                {p.barcode && <span className="text-blue-600">Barcode: {p.barcode}</span>}
                                {isLowStock && <Badge variant="destructive" className="text-[10px] h-4 px-1 py-0">Low Stock</Badge>}
                              </div>
                            </td>
                            <td className="p-4 text-center font-semibold text-lg">{item.on_hand_quantity}</td>
                            <td className="p-4 text-center text-amber-600 font-medium">{item.allocated_quantity}</td>
                            <td className="p-4 text-center text-emerald-600 font-bold text-lg">{available}</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <TransactionDialog 
                                  type="receive" 
                                  productId={p.id} 
                                  locationId={loc.id} 
                                  productName={p.name} 
                                />
                                <TransactionDialog 
                                  type="issue" 
                                  productId={p.id} 
                                  locationId={loc.id} 
                                  productName={p.name} 
                                  projects={projects}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
