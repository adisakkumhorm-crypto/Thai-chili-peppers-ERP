"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];
type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];

export async function getAccounts(orgId: string): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("code", { ascending: true });

  if (error) {
    console.error("Error fetching accounts:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createAccount(orgId: string, payload: Omit<AccountInsert, "org_id">) {
  const supabase = await createClient();
  
  const insertData: AccountInsert = {
    ...payload,
    org_id: orgId,
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating account:", error);
    throw new Error(error.message);
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/settings/accounting");
  revalidatePath("/settings/accounts");
  return data;
}

export async function updateAccount(id: string, payload: AccountUpdate) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating account:", error);
    throw new Error(error.message);
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/settings/accounting");
  revalidatePath("/settings/accounts");
  return data;
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting account:", error);
    throw new Error(error.message);
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/settings/accounting");
  revalidatePath("/settings/accounts");
}
