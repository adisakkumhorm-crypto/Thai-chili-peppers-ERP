import { PageHeader } from "@/components/page-header"
import { Package } from "lucide-react"

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products & Inventory"
        description="Manage your products, SKUs, pricing, and stock levels."
        icon={<Package className="size-6 text-primary" />}
      />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <Package className="size-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-semibold">No products yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm mb-4">
          Start building your inventory by adding your first product.
        </p>
      </div>
    </>
  )
}
