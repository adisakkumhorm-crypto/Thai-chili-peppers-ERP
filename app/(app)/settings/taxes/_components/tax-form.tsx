"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch"
import type { Database } from "@/lib/types/database"

type TaxType = Database["public"]["Enums"]["tax_type"]

const FormSchema = z.object({
  name: z.string().min(1, "กรุณาระบุชื่อภาษี (เช่น VAT 7%)"),
  type: z.enum(["vat", "wht"] as const),
  rate: z.coerce.number().min(0, "อัตราภาษีต้องไม่ติดลบ"),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

export function TaxForm({
  defaultValues,
  action,
}: {
  defaultValues?: Partial<FormValues>
  action: (input: FormValues) => Promise<void>
}) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      type: defaultValues?.type ?? "vat",
      rate: defaultValues?.rate ?? 7,
      is_active: defaultValues?.is_active ?? true,
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await action(values)
            toast.success("บันทึกข้อมูลภาษีเรียบร้อย")
          } catch (e: any) {
            toast.error(e.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล")
          }
        })}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อภาษี (Name)</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น VAT 7%" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>อัตราภาษี (Rate %)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="7" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
             <FormItem>
              <FormLabel>ประเภทภาษี (Type)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกประเภทภาษี" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="vat">ภาษีมูลค่าเพิ่ม (VAT)</SelectItem>
                  <SelectItem value="wht">ภาษีหัก ณ ที่จ่าย (WHT)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">สถานะการใช้งาน (Active)</FormLabel>
                <FormDescription>
                  ภาษีที่ปิดใช้งานจะไม่แสดงให้เลือกตอนสร้างเอกสาร
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

        <div className="flex gap-2 justify-end pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push('/settings/taxes')}
            disabled={form.formState.isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "กำลังบันทึก..." : "บันทึกภาษี"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
