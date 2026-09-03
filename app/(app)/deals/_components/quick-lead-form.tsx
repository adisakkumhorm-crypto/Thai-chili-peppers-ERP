"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import type { QuickLeadInput } from "../actions"

const formSchema = z.object({
  clientName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
  phone: z.string().optional(),
  valueBaht: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function QuickLeadForm({
  action,
  submitLabel = "บันทึกลูกค้า",
}: {
  action: (values: QuickLeadInput) => Promise<{ error?: string }>
  submitLabel?: string
}) {
  const router = useRouter()
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      phone: "",
      valueBaht: "",
    },
  })

  async function onSubmit(values: FormValues) {
    const payload: QuickLeadInput = {
      clientName: values.clientName,
      phone: values.phone,
      valueBaht: Number(values.valueBaht) || 0,
    }

    const res = await action(payload)
    if (res?.error) {
      toast.error("บันทึกไม่สำเร็จ", { description: res.error })
      return
    }
    toast.success("บันทึกลูกค้าใหม่เรียบร้อย 🎉")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="clientName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อลูกค้า / ชื่อร้าน <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="เช่น คุณสมชาย, ร้านโชห่วยปากซอย" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>เบอร์โทรติดต่อ (ถ้ามี)</FormLabel>
              <FormControl>
                <Input placeholder="08X-XXX-XXXX" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valueBaht"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ยอดเงินประเมินเบื้องต้น (บาท)</FormLabel>
              <FormControl>
                <Input 
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-2 flex items-center gap-3">
          <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => router.back()}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Form>
  )
}
