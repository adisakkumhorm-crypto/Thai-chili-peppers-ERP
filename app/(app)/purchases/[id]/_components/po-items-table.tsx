"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Trash2, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addPOItem, deletePOItem } from "../../actions"

type POItem = {
  id: string
  po_id: string
  product_id: string
  quantity: number
  unit_price: number
  products: { name: string; sku: string | null }
  projects?: { name: string } | null
}

const AddItemSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  project_id: z.string().nullable().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Price must be >= 0"),
})

export function POItemsTable({
  poId,
  items,
  products,
  projects,
  isEditable,
  totalAmount,
}: {
  poId: string
  items: POItem[]
  products: { id: string; name: string; cost: number }[]
  projects: { id: string; name: string }[]
  isEditable: boolean
  totalAmount: number
}) {
  const [isAdding, setIsAdding] = useState(false)
  const form = useForm<z.infer<typeof AddItemSchema>>({
    resolver: zodResolver(AddItemSchema) as any,
    defaultValues: {
      product_id: "",
      project_id: "",
      quantity: 1,
      unit_price: 0,
    },
  })

  async function onSubmit(values: z.infer<typeof AddItemSchema>) {
    const res = await addPOItem({ ...values, po_id: poId })
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success("Item added")
    setIsAdding(false)
    form.reset()
  }

  async function onDelete(itemId: string) {
    if (!confirm("Are you sure you want to remove this item?")) return
    const res = await deletePOItem(itemId, poId)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success("Item removed")
    }
  }

  const selectedProductId = useWatch({
    control: form.control,
    name: "product_id",
  })
  
  // Auto-fill unit_price when a product is selected
  const handleProductChange = (val: string | null) => {
    if (!val) return;
    form.setValue("product_id", val)
    const product = products.find(p => p.id === val)
    if (product) {
      form.setValue("unit_price", product.cost)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl ring-1 ring-foreground/10 overflow-x-auto print:ring-0 print:border-y print:rounded-none">
        <Table>
          <TableHeader className="print:hidden">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price (฿)</TableHead>
              <TableHead className="text-right">Total (฿)</TableHead>
              {isEditable && <TableHead className="w-[50px] print:hidden"></TableHead>}
            </TableRow>
          </TableHeader>
          {/* Create a cleaner header for print */}
          <thead className="hidden print:table-header-group border-b">
            <tr>
              <th className="text-left font-medium pb-2 text-sm">Product</th>
              <th className="text-left font-medium pb-2 text-sm">Project</th>
              <th className="text-right font-medium pb-2 text-sm w-[100px]">Qty</th>
              <th className="text-right font-medium pb-2 text-sm w-[120px]">Unit Price (฿)</th>
              <th className="text-right font-medium pb-2 text-sm w-[120px]">Total (฿)</th>
            </tr>
          </thead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEditable ? 6 : 5} className="text-center text-muted-foreground py-6">
                  No items in this order yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.products?.name}</div>
                    {item.products?.sku && <div className="text-xs text-muted-foreground">{item.products.sku}</div>}
                  </TableCell>
                  <TableCell>
                  {item.projects ? (
                    <span className="text-xs bg-muted px-2 py-1 rounded-md border">{item.projects.name}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                  {isEditable && (
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            {items.length > 0 && (
               <TableRow className="bg-muted/50">
                 <TableCell colSpan={4} className="text-right font-semibold">Total Amount</TableCell>
                 <TableCell className="text-right font-bold text-primary">฿{totalAmount.toFixed(2)}</TableCell>
                 {isEditable && <TableCell></TableCell>}
               </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isEditable && (
        <>
          {isAdding ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <h4 className="font-medium text-sm">Add Item</h4>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-3 flex-wrap sm:flex-nowrap">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Product</label>
                  <Select onValueChange={handleProductChange} value={selectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground">Project (Optional)</label>
                  <Select onValueChange={(val) => form.setValue("project_id", val === "none" ? "" : val)} value={form.watch("project_id") || "none"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Central Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Central Stock --</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-[100px]">
                  <label className="text-xs font-medium text-muted-foreground">Qty</label>
                  <Input type="number" {...form.register("quantity")} />
                </div>
                <div className="space-y-1.5 w-[120px]">
                  <label className="text-xs font-medium text-muted-foreground">Unit Price (฿)</label>
                  <Input type="number" step="0.01" {...form.register("unit_price")} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={form.formState.isSubmitting}>Add</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 size-4" />
              Add Product
            </Button>
          )}
        </>
      )}
    </div>
  )
}
