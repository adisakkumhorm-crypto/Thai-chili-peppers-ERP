"use client"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createSalesOrder } from "../actions"

const schema = z.object({
  channel_id: z.string().optional().or(z.literal("")),
  customer_name: z.string().min(1, "Required"),
  customer_phone: z.string().optional(),
  shipping_address: z.string().optional(),
  payment_method: z.enum(["bank_transfer", "cod", "credit_card", "platform_wallet"]),
  notes: z.string().optional(),
})

export function SalesOrderForm({ channels }: { channels: any[] }) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { channel_id: "", customer_name: "", customer_phone: "", shipping_address: "", payment_method: "bank_transfer", notes: "" }
  })

  async function onSubmit(vals: z.infer<typeof schema>) {
    const res = await createSalesOrder(vals as any)
    if (res?.error) toast.error(res.error)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select onValueChange={v => form.setValue("channel_id", v || "")} value={form.watch("channel_id")}>
            <SelectTrigger><SelectValue placeholder="Direct / Walk-in" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Direct / Walk-in</SelectItem>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select onValueChange={v => form.setValue("payment_method", v as any)} value={form.watch("payment_method")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="cod">COD (เก็บเงินปลายทาง)</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="platform_wallet">Platform Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Customer Name</Label>
        <Input {...form.register("customer_name")} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input {...form.register("customer_phone")} />
      </div>
      <div className="space-y-2">
        <Label>Shipping Address</Label>
        <Textarea {...form.register("shipping_address")} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea {...form.register("notes")} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>Create Order</Button>
      </div>
    </form>
  )
}
