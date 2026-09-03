"use client"

import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatTHB } from "@/lib/money"
import type { Database } from "@/lib/types/database"

type Account = Database["public"]["Tables"]["accounts"]["Row"]

const LineSchema = z.object({
  account_id: z.string().min(1, "กรุณาเลือกบัญชี"),
  description: z.string().optional(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
}).refine(data => {
  return (data.debit > 0 && data.credit === 0) || (data.debit === 0 && data.credit > 0) || (data.debit === 0 && data.credit === 0);
}, {
  message: "ต้องระบุเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง",
  path: ["debit"],
});

const FormSchema = z.object({
  entry_date: z.string().min(1, "กรุณาระบุวันที่"),
  entry_number: z.string().min(1, "กรุณาระบุเลขที่ใบสำคัญ"),
  description: z.string().min(1, "กรุณาระบุคำอธิบาย"),
  lines: z.array(LineSchema).min(2, "ต้องมีอย่างน้อย 2 รายการ (เดบิตและเครดิต)"),
}).refine(data => {
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
  return totalDebit === totalCredit && totalDebit > 0;
}, {
  message: "ยอดรวมเดบิตต้องเท่ากับเครดิต และต้องมากกว่า 0",
  path: ["lines"],
});

type FormValues = z.infer<typeof FormSchema>

export function JournalForm({
  accounts,
  action,
}: {
  accounts: Account[]
  action: (input: any) => Promise<void>
}) {
  const router = useRouter()
  
  // Format today's date for default entry_date (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema) as any,
    defaultValues: {
      entry_date: today,
      entry_number: `JV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}-0001`,
      description: "",
      lines: [
        { account_id: "", description: "", debit: 0, credit: 0 },
        { account_id: "", description: "", debit: 0, credit: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  const watchLines = useWatch({
    control: form.control,
    name: "lines",
  }) || form.getValues("lines")
  const totalDebit = watchLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
  const totalCredit = watchLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const payload = {
              entry_date: values.entry_date,
              entry_number: values.entry_number,
              description: values.description,
              source: "manual",
              lines: values.lines.map(line => ({
                account_id: line.account_id,
                description: line.description || "",
                debit_amount_satang: Math.round(line.debit * 100),
                credit_amount_satang: Math.round(line.credit * 100),
              }))
            };
            await action(payload)
            toast.success("บันทึกสมุดรายวันเรียบร้อย")
          } catch (e: any) {
            toast.error(e.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล")
          }
        })}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="entry_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เลขที่ใบสำคัญ (Entry No.)</FormLabel>
                <FormControl>
                  <Input placeholder="JV-202308-0001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="entry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>วันที่ (Date)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>คำอธิบายรายการ (Description)</FormLabel>
              <FormControl>
                <Input placeholder="คำอธิบายการบันทึกบัญชี..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">รายการบัญชี (Lines)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ account_id: "", description: "", debit: 0, credit: 0 })}
            >
              <Plus className="size-4 mr-2" />
              เพิ่มรายการ
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
              <div>บัญชี (Account)</div>
              <div>คำอธิบาย (Description)</div>
              <div className="text-right">เดบิต (Debit)</div>
              <div className="text-right">เครดิต (Credit)</div>
              <div></div>
            </div>
            <div className="divide-y">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-2 items-start">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.account_id`}
                    render={({ field: selectField }) => (
                      <FormItem>
                        <Select onValueChange={selectField.onChange} value={selectField.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="เลือกบัญชี" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`lines.${index}.description`}
                    render={({ field: inputField }) => (
                      <FormItem>
                        <FormControl>
                          <Input className="h-8 text-xs" placeholder="คำอธิบาย..." {...inputField} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`lines.${index}.debit`}
                    render={({ field: inputField }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="h-8 text-xs text-right" 
                            placeholder="0.00" 
                            {...inputField}
                            onChange={(e) => {
                              inputField.onChange(e);
                              if (Number(e.target.value) > 0) {
                                form.setValue(`lines.${index}.credit`, 0);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`lines.${index}.credit`}
                    render={({ field: inputField }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="h-8 text-xs text-right" 
                            placeholder="0.00" 
                            {...inputField}
                            onChange={(e) => {
                              inputField.onChange(e);
                              if (Number(e.target.value) > 0) {
                                form.setValue(`lines.${index}.debit`, 0);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 2}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            {/* Footer / Summary */}
            <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-3 bg-muted/20 border-t font-medium">
              <div className="col-span-2 text-right text-sm">ยอดรวม (Total)</div>
              <div className={`text-right text-sm ${totalDebit !== totalCredit ? 'text-destructive' : ''}`}>
                {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-right text-sm ${totalDebit !== totalCredit ? 'text-destructive' : ''}`}>
                {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div></div>
            </div>
          </div>
          {form.formState.errors.lines?.root && (
            <p className="text-sm font-medium text-destructive mt-2">
              {form.formState.errors.lines.root.message}
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push('/finance?status=journals')}
            disabled={form.formState.isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || totalDebit !== totalCredit || totalDebit === 0}>
            {form.formState.isSubmitting ? "กำลังบันทึก..." : "บันทึกบัญชี"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
