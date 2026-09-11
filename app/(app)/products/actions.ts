"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireOrgContext, requireRole } from "@/lib/auth"

const ProductInput = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be >= 0").default(0),
  cost: z.coerce.number().min(0, "Cost must be >= 0").default(0),
  })

function nullify(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function createProduct(
  input: z.infer<typeof ProductInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = ProductInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from("products")
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name.trim(),
      sku: nullify(parsed.data.sku),
      description: nullify(parsed.data.description),
      price: parsed.data.price,
      cost: parsed.data.cost,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath("/products")
  redirect("/products")
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof ProductInput>
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  const parsed = ProductInput.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name.trim(),
      sku: nullify(parsed.data.sku),
      description: nullify(parsed.data.description),
      price: parsed.data.price,
      cost: parsed.data.cost,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/products")
  return {}
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext()
  try {
    requireRole(ctx, ["owner", "admin"])
  } catch {
    return { error: "Only owners and admins can delete products." }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId)

  if (error) return { error: error.message }

  revalidatePath("/products")
  redirect("/products")
}
