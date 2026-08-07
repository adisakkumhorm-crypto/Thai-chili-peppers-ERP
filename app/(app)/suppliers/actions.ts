"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"

const SupplierInput = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().optional(),
  phone: z.string().optional(),
  tax_id: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

function nullify(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function createSupplier(
  input: z.infer<typeof SupplierInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = SupplierInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name.trim(),
      email: nullify(parsed.data.email),
      phone: nullify(parsed.data.phone),
      tax_id: nullify(parsed.data.tax_id),
      address: nullify(parsed.data.address),
      notes: nullify(parsed.data.notes),
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/suppliers")
  redirect(`/suppliers/${data.id}`)
}

export async function updateSupplier(
  id: string,
  input: z.infer<typeof SupplierInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = SupplierInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name.trim(),
      email: nullify(parsed.data.email),
      phone: nullify(parsed.data.phone),
      tax_id: nullify(parsed.data.tax_id),
      address: nullify(parsed.data.address),
      notes: nullify(parsed.data.notes),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/suppliers")
  revalidatePath(`/suppliers/${id}`)
  return {}
}

export async function deleteSupplier(id: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "Only owners and admins can delete suppliers." }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/suppliers")
  redirect("/suppliers")
}
