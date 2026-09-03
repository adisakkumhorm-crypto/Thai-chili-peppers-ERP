"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function requestAccess(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Not logged in")
  }

  // Use admin client to bypass RLS and get the single organization
  const adminClient = createAdminClient()
  const { data: org } = await adminClient.from("organizations").select("id").limit(1).single()
  
  if (!org) {
    throw new Error("No organization found in the system.")
  }

  const { error } = await adminClient.from("join_requests" as any).insert({
    user_id: user.id,
    org_id: org.id,
    status: "pending"
  })

  if (error && error.code !== '23505') {
    console.error("Request error:", error)
  }

  revalidatePath("/no-workspace")
}
