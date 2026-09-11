"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/types/database";

type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];
type JournalEntryLine = Database["public"]["Tables"]["journal_entry_lines"]["Row"];

export type JournalEntryWithLines = JournalEntry & {
  lines: (JournalEntryLine & { account: { code: string; name: string } | null })[];
};

export async function getJournalEntries(orgId: string): Promise<JournalEntryWithLines[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(`
      *,
      lines:journal_entry_lines(
        *,
        account:accounts(code, name)
      )
    `)
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching journal entries:", error);
    throw new Error(error.message);
  }

  // Type assertion needed because supabase join returns an array for one-to-many, 
  // but the account join is many-to-one (returns single object).
  return data as unknown as JournalEntryWithLines[];
}

export type CreateJournalEntryPayload = {
  entry_date: string;
  entry_number: string;
  description: string;
  source?: Database["public"]["Enums"]["journal_entry_source"];
  reference_id?: string;
  lines: {
    account_id: string;
    description?: string;
    debit_amount_satang: number;
    credit_amount_satang: number;
  }[];
};

export async function createManualJournalEntry(orgId: string, payload: CreateJournalEntryPayload) {
  const supabase = await createClient();

  // Validate double-entry accounting (debit == credit)
  const totalDebit = payload.lines.reduce((sum, line) => sum + line.debit_amount_satang, 0);
  const totalCredit = payload.lines.reduce((sum, line) => sum + line.credit_amount_satang, 0);

  if (totalDebit !== totalCredit) {
    throw new Error(`ยอดรวมเดบิต (${totalDebit}) ไม่เท่ากับเครดิต (${totalCredit})`);
  }
  
  if (totalDebit === 0) {
    throw new Error("ต้องมียอดจำนวนเงินมากกว่า 0");
  }

  // 1. Create Header
  const { data: header, error: headerError } = await supabase
    .from("journal_entries")
    .insert({
      org_id: orgId,
      entry_date: payload.entry_date,
      entry_number: payload.entry_number,
      description: payload.description,
      source: payload.source ?? "manual",
      reference_id: payload.reference_id,
      status: "draft"
    })
    .select()
    .single();

  if (headerError) {
    console.error("Error creating journal entry header:", headerError);
    throw new Error(headerError.message);
  }

  // 2. Create Lines
  const linesToInsert = payload.lines.map((line) => ({
    org_id: orgId,
    entry_id: header.id,
    account_id: line.account_id,
    description: line.description,
    debit_amount_satang: line.debit_amount_satang,
    credit_amount_satang: line.credit_amount_satang,
  }));

  const { error: linesError } = await supabase
    .from("journal_entry_lines")
    .insert(linesToInsert);

  if (linesError) {
    console.error("Error creating journal entry lines:", linesError);
    // Rollback header since we couldn't insert lines
    await supabase.from("journal_entries").delete().eq("id", header.id);
    throw new Error(linesError.message);
  }

  // 3. Post Journal
  const { error: postError } = await supabase
    .from("journal_entries")
    .update({ status: "posted" })
    .eq("id", header.id);

  if (postError) {
    console.error("Error posting journal entry:", postError);
    throw new Error(postError.message);
  }

  revalidatePath("/finance");
  revalidatePath("/finance/journals");
  return header;
}
