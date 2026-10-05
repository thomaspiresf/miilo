import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import type { CashAccount, CashEntry, CashEntryKind } from "@/lib/cash";

const MISSING = /relation .* does not exist|could not find the table|schema cache/i;

/* eslint-disable @typescript-eslint/no-explicit-any */
const map = (r: any): CashEntry => ({
  id: r.id,
  occurred_on: r.occurred_on,
  account: r.account,
  amount: Number(r.amount),
  kind: r.kind,
  note: r.note ?? null,
  group_id: r.group_id ?? null,
  created_by: r.created_by ?? null,
  created_at: r.created_at,
});

/** Movimentações manuais do caixa, mais recentes primeiro. `tableMissing` = migração ainda não rodou. */
export const listCashEntries = cache(async (): Promise<{ rows: CashEntry[]; tableMissing: boolean }> => {
  if (!hasSupabaseAdmin()) return { rows: [], tableMissing: false };
  const { data, error } = await createAdminClient()
    .from("cash_entries")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (MISSING.test(error.message)) return { rows: [], tableMissing: true };
    throw error;
  }
  return { rows: (data ?? []).map(map), tableMissing: false };
});

export type NewCashEntry = {
  occurred_on: string;
  account: CashAccount;
  amount: number;
  kind: CashEntryKind;
  note: string | null;
  group_id?: string | null;
};

export async function createCashEntries(entries: NewCashEntry[], actorEmail: string | null): Promise<void> {
  if (!hasSupabaseAdmin()) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY para salvar movimentações.");
  const { error } = await createAdminClient()
    .from("cash_entries")
    .insert(entries.map((e) => ({ ...e, created_by: actorEmail })));
  if (error) {
    if (MISSING.test(error.message)) {
      throw new Error("Rode a migração supabase/migration-cash-entries.sql no SQL Editor do Supabase.");
    }
    throw error;
  }
}

/** Apaga uma movimentação (e a outra metade, se for uma transferência). */
export async function deleteCashEntry(id: string): Promise<void> {
  if (!hasSupabaseAdmin()) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY.");
  const admin = createAdminClient();
  const { data } = await admin.from("cash_entries").select("group_id").eq("id", id).maybeSingle();
  const q = data?.group_id ? admin.from("cash_entries").delete().eq("group_id", data.group_id) : admin.from("cash_entries").delete().eq("id", id);
  const { error } = await q;
  if (error) throw error;
}
