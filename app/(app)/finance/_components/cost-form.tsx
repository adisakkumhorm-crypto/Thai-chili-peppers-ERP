"use client"

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
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

import { SelectField, type Option } from "./form-fields"

const CATEGORY_OPTIONS: Option[] = [
  { value: "software", label: "Software" },
  { value: "contractor", label: "Contractor" },
  { value: "infra", label: "Infrastructure" },
  { value: "marketing", label: "Marketing" },
  { value: "salary", label: "Salary" },
  { value: "other", label: "Other" },
]

const Schema = z.object({
  category: z.enum([
    "software",
    "contractor",
    "infra",
    "marketing",
    "salary",
    "other",
  ]),
  subtotalBaht: z.coerce.number().min(0, "Amount must be 0 or more"),
  vat_rate_id: z.string().optional(),
  wht_rate_id: z.string().optional(),
  vat_amountBaht: z.coerce.number().min(0).default(0),
  wht_amountBaht: z.coerce.number().min(0).default(0),
  incurred_on: z.string().optional(),
  vendor: z.string().optional(),
  project_id: z.string().optional(),
  notes: z.string().optional(),
  po_id: z.string().optional(),
  supplier_id: z.string().optional(),
})

type Values = z.infer<typeof Schema>

export function CostForm({
  projects,
  taxes,
  today,
  action,
}: {
  projects: Option[]
  taxes: { id: string; name: string; rate: number; type: string }[]
  today: string
  action: (values: Values) => Promise<{ error?: string } | void>
}) {
  const form = useForm<z.input<typeof Schema>, unknown, Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      category: "other",
      subtotalBaht: 0,
      vat_amountBaht: 0,
      wht_amountBaht: 0,
      vat_rate_id: undefined,
      wht_rate_id: undefined,
      incurred_on: today,
      vendor: "",
      project_id: "",
      notes: "",
      po_id: undefined,
      supplier_id: undefined,
    },
  })

  // Auto-calculate VAT and WHT
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
          const res = await action(values)
          if (res?.error) {
            toast.error(res.error)
            return
          }
          toast.success("Cost saved")
        })}
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="category"
            label="Category"
            placeholder="Select category"
            options={CATEGORY_OPTIONS}
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

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="incurred_on"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incurred on</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Figma, AWS, freelancer…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <SelectField
          name="project_id"
          label="Project"
          placeholder="No project"
          options={projects}
          optional
          noneLabel="No project"
          description="Optional — attribute this cost to a project."
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="What was this for?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save cost
          </Button>
        </div>
      </form>
    </Form>
  )
}
