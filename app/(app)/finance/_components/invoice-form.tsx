"use client"

import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useEffect } from "react"

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

import { SelectField, type Option } from "./form-fields"

const STATUS_OPTIONS: Option[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
]

const INTERVAL_OPTIONS: Option[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

const Schema = z
  .object({
    client_id: z.string().min(1, "Choose a client"),
    project_id: z.string().optional(),
    number: z.string().min(1, "Invoice number is required"),
    status: z.enum([
      "draft",
      "sent",
      "partially_paid",
      "paid",
      "overdue",
      "cancelled",
    ]),
    issue_date: z.string().optional(),
    due_date: z.string().optional(),
    subtotalBaht: z.coerce.number().min(0, "Amount must be 0 or more"),
    vat_rate_id: z.string().optional(),
    wht_rate_id: z.string().optional(),
    vat_amountBaht: z.coerce.number().min(0).default(0),
    wht_amountBaht: z.coerce.number().min(0).default(0),
    is_recurring: z.boolean(),
    recurring_interval: z
      .enum(["weekly", "monthly", "quarterly", "yearly"])
      .optional(),
    notes: z.string().optional(),
  })
  .refine((v) => !v.is_recurring || !!v.recurring_interval, {
    path: ["recurring_interval"],
    message: "Pick an interval for recurring invoices",
  })

type Values = z.infer<typeof Schema>
export type InvoiceFormSubmitValues = Values

export type InvoiceFormValues = {
  client_id: string
  project_id: string
  number: string
  status: Values["status"]
  issue_date: string
  due_date: string
  subtotalBaht: number
  vat_rate_id?: string
  wht_rate_id?: string
  vat_amountBaht: number
  wht_amountBaht: number
  is_recurring: boolean
  recurring_interval?: Values["recurring_interval"]
  notes: string
}

export function InvoiceForm({
  clients,
  projects,
  taxes,
  defaultValues,
  submitLabel,
  action,
}: {
  clients: Option[]
  projects: Option[]
  taxes: { id: string; name: string; rate: number; type: string }[]
  defaultValues: InvoiceFormValues
  submitLabel: string
  action: (values: Values) => Promise<{ error?: string } | void>
}) {
  const router = useRouter()
  const form = useForm<z.input<typeof Schema>, unknown, Values>({
    resolver: zodResolver(Schema),
    defaultValues,
  })

  const isRecurring = useWatch({ control: form.control, name: "is_recurring" })
  
  // Auto-calculate VAT and WHT based on subtotal and selected rates
  const subtotal = useWatch({ control: form.control, name: "subtotalBaht" })
  const vatRateId = useWatch({ control: form.control, name: "vat_rate_id" })
  const whtRateId = useWatch({ control: form.control, name: "wht_rate_id" })

  useEffect(() => {
    if (!subtotal) return;
    
    if (vatRateId) {
      const rate = taxes.find(t => t.id === vatRateId)?.rate || 0
      form.setValue("vat_amountBaht", Number(((Number(subtotal) * rate) / 100).toFixed(2)))
    } else {
      form.setValue("vat_amountBaht", 0)
    }

    if (whtRateId) {
      const rate = taxes.find(t => t.id === whtRateId)?.rate || 0
      form.setValue("wht_amountBaht", Number(((Number(subtotal) * rate) / 100).toFixed(2)))
    } else {
      form.setValue("wht_amountBaht", 0)
    }
  }, [subtotal, vatRateId, whtRateId, taxes, form])

  const vatOptions = taxes.filter(t => t.type === 'vat').map(t => ({ value: t.id, label: t.name }))
  const whtOptions = taxes.filter(t => t.type === 'wht').map(t => ({ value: t.id, label: t.name }))

  const vatAmountBaht = useWatch({ control: form.control, name: "vat_amountBaht" })
  const whtAmountBaht = useWatch({ control: form.control, name: "wht_amountBaht" })
  const total = (Number(subtotal) || 0) + (Number(vatAmountBaht) || 0) - (Number(whtAmountBaht) || 0)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          const payload = {
            ...values,
            recurring_interval: values.is_recurring
              ? values.recurring_interval
              : undefined,
          }
          const res = await action(payload)
          if (res?.error) {
            toast.error(res.error)
            return
          }
          toast.success("Invoice saved")
          router.refresh()
        })}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="client_id"
            label="Client"
            placeholder="Select a client"
            options={clients}
          />
          <SelectField
            name="project_id"
            label="Project"
            placeholder="No project"
            options={projects}
            optional
            noneLabel="No project"
            description="Optional — link to a project."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice number</FormLabel>
                <FormControl>
                  <Input placeholder="INV-2026-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SelectField
            name="status"
            label="Status"
            placeholder="Select status"
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="issue_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-medium text-sm">Amount & Taxes</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="subtotalBaht"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subtotal (มูลค่าก่อนภาษี)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={(field.value ?? "") as number | string}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4 p-4 border rounded-md bg-background">
              <SelectField
                name="vat_rate_id"
                label="VAT Rate (ภาษีมูลค่าเพิ่ม)"
                placeholder="No VAT"
                options={vatOptions}
                optional
                noneLabel="No VAT"
              />
              <FormField
                control={form.control}
                name="vat_amountBaht"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Amount (ยอด VAT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" name={field.name} ref={field.ref} onBlur={field.onBlur} value={(field.value ?? "") as number | string} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4 p-4 border rounded-md bg-background">
              <SelectField
                name="wht_rate_id"
                label="WHT Rate (หัก ณ ที่จ่าย)"
                placeholder="No WHT"
                options={whtOptions}
                optional
                noneLabel="No WHT"
              />
              <FormField
                control={form.control}
                name="wht_amountBaht"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WHT Amount (ยอดหัก ณ ที่จ่าย)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" name={field.name} ref={field.ref} onBlur={field.onBlur} value={(field.value ?? "") as number | string} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t mt-4">
            <span className="font-semibold text-sm">Grand Total (ยอดสุทธิ)</span>
            <span className="font-bold text-lg">{total.toLocaleString('en-US', { minimumFractionDigits: 2 })} ฿</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="is_recurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Recurring invoice</FormLabel>
                <FormDescription>
                  Bills the client on a repeating schedule.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {isRecurring ? (
          <SelectField
            name="recurring_interval"
            label="Recurring interval"
            placeholder="Select interval"
            options={INTERVAL_OPTIONS}
          />
        ) : null}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Anything worth remembering about this invoice…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
