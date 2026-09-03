"use client"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addOrderItem, deleteOrderItem } from "../../actions"

const AddItemSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Price must be >= 0"),
})

export function OrderItemsTable({
  orderId,
  items,
  products,
  isEditable,
  totalAmount,
}: {
  orderId: string
  items: any[]
  products: { id: string; name: string; price: number; stock_quantity: number; barcode: string | null }[]
  isEditable: boolean
  totalAmount: number
}) {
  const [isAdding, setIsAdding] = useState(false)
  const form = useForm<z.infer<typeof AddItemSchema>>({
    resolver: zodResolver(AddItemSchema) as any,
    defaultValues: { product_id: "", quantity: 1, unit_price: 0 },
  })

  async function onSubmit(values: z.infer<typeof AddItemSchema>) {
    const res = await addOrderItem({ ...values, order_id: orderId })
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success("Item added")
    setIsAdding(false)
    form.reset()
  }

  async function onDelete(itemId: string, productId: string, qty: number) {
    if (!confirm("Remove this item?")) return
    const res = await deleteOrderItem(itemId, orderId, productId, qty)
    if (res?.error) toast.error(res.error)
    else toast.success("Item removed")
  }

  const handleProductChange = (val: string | null) => {
    if (!val) return;
    form.setValue("product_id", val)
    const product = products.find(p => p.id === val)
    if (product) {
      form.setValue("unit_price", product.price)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {isEditable && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={isEditable ? 5 : 4} className="text-center text-muted-foreground py-6">No items</TableCell></TableRow>
            ) : (
              items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.products?.name}</div>
                    {item.products?.barcode && <div className="text-xs text-muted-foreground">Barcode: {item.products.barcode}</div>}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{Number(item.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                  {isEditable && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => onDelete(item.id, item.product_id, item.quantity)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            {items.length > 0 && (
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="text-right font-semibold">Total Amount</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">฿{totalAmount.toFixed(2)}</TableCell>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-3 flex-wrap sm:flex-nowrap">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium">Product</label>
                  <Select onValueChange={handleProductChange} value={form.watch("product_id")}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (Stock: {p.stock_quantity}) - ฿{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-[100px]">
                  <label className="text-xs font-medium">Qty</label>
                  <Input type="number" min="1" {...form.register("quantity")} />
                </div>
                <div className="space-y-1.5 w-[120px]">
                  <label className="text-xs font-medium">Price (฿)</label>
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
              <Plus className="mr-2 size-4" /> Add Product
            </Button>
          )}
        </>
      )}
    </div>
  )
}
