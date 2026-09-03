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

type AccountType = Database["public"]["Enums"]["account_type"]

const FormSchema = z.object({
  code: z.string().min(1, "กรุณาระบุรหัสบัญชี"),
  name: z.string().min(1, "กรุณาระบุชื่อบัญชี"),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"] as const),
  description: z.string().optional(),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

export function AccountForm({
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
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      type: defaultValues?.type ?? "asset",
      description: defaultValues?.description ?? "",
      is_active: defaultValues?.is_active ?? true,
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await action(values)
            toast.success("บันทึกข้อมูลบัญชีเรียบร้อย")
          } catch (e: any) {
            toast.error(e.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล")
          }
        })}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสบัญชี (Code)</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น 1001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อบัญชี (Name)</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น เงินสด, ลูกหนี้การค้า" {...field} />
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
              <FormLabel>หมวดหมู่บัญชี (Type)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดบัญชี" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="asset">สินทรัพย์ (Asset)</SelectItem>
                  <SelectItem value="liability">หนี้สิน (Liability)</SelectItem>
                  <SelectItem value="equity">ส่วนของเจ้าของ (Equity)</SelectItem>
                  <SelectItem value="revenue">รายได้ (Revenue)</SelectItem>
                  <SelectItem value="expense">ค่าใช้จ่าย (Expense)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>รายละเอียด (Description)</FormLabel>
              <FormControl>
                <Input placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)" {...field} />
              </FormControl>
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
                  บัญชีที่ปิดใช้งานจะไม่แสดงให้เลือกในสมุดรายวัน
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
            onClick={() => router.push('/settings/accounts')}
            disabled={form.formState.isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "กำลังบันทึก..." : "บันทึกบัญชี"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
