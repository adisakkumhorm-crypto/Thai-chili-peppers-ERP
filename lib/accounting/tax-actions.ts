"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/types/database";

type TaxRate = Database["public"]["Tables"]["tax_rates"]["Row"];
type TaxRateInsert = Database["public"]["Tables"]["tax_rates"]["Insert"];
type TaxRateUpdate = Database["public"]["Tables"]["tax_rates"]["Update"];

export async function getTaxRates(orgId: string): Promise<TaxRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("org_id", orgId)
    .order("type", { ascending: true })
    .order("rate", { ascending: true });

  if (error) {
    console.error("Error fetching tax rates:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createTaxRate(orgId: string, payload: Omit<TaxRateInsert, "org_id">) {
  const supabase = await createClient();
  
  const insertData: TaxRateInsert = {
    ...payload,
    org_id: orgId,
  };

  const { data, error } = await supabase
    .from("tax_rates")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating tax rate:", error);
    throw new Error(error.message);
  }

  revalidatePath("/settings/taxes");
  return data;
}

export async function updateTaxRate(id: string, payload: TaxRateUpdate) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating tax rate:", error);
    throw new Error(error.message);
  }

  revalidatePath("/settings/taxes");
  return data;
}

export async function deleteTaxRate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tax_rates").delete().eq("id", id);

  if (error) {
    console.error("Error deleting tax rate:", error);
    throw new Error(error.message);
  }

  revalidatePath("/settings/taxes");
}
