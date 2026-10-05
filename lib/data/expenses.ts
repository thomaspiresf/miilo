import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { shiftMonth, type Expense } from "@/lib/expenses";
import type { ExpenseInput } from "@/lib/expense-schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING_TABLE = /relation .* does not exist|could not find the table|schema cache/i;

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    spent_on: row.spent_on,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    supplier: row.supplier ?? null,
    notes: row.notes ?? null,
    receipt_path: row.receipt_path ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
  };
}

function assertPersistable() {
  if (!hasSupabaseAdmin()) {
    throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY (chave sb_secret_…) para salvar gastos.");
  }
}

function monthBounds(ym: string) {
  return { from: `${ym}-01`, to: `${shiftMonth(ym, 1)}-01` };
}

/** Gastos do mês ("YYYY-MM"), mais recentes primeiro. `tableMissing` = migração ainda não rodou. */
export async function listExpensesForMonth(
  ym: string,
): Promise<{ rows: Expense[]; tableMissing: boolean }> {
  if (!hasSupabaseAdmin()) return { rows: [], tableMissing: false };
  const { from, to } = monthBounds(ym);
  const { data, error } = await createAdminClient()
    .from("expenses")
    .select("*")
    .gte("spent_on", from)
    .lt("spent_on", to)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (MISSING_TABLE.test(error.message)) return { rows: [], tableMissing: true };
    throw error;
  }
  return { rows: (data ?? []).map(mapExpense), tableMissing: false };
}

export async function createExpense(input: ExpenseInput, actorEmail: string | null): Promise<Expense> {
  assertPersistable();
  const { data, error } = await createAdminClient()
    .from("expenses")
    .insert({
      spent_on: input.spentOn,
      category: input.category,
      description: input.description,
      amount: input.amount,
      supplier: input.supplier,
      notes: input.notes,
      receipt_path: input.receiptPath,
      created_by: actorEmail,
    })
    .select("*")
    .single();
  if (error) {
    if (MISSING_TABLE.test(error.message)) {
      throw new Error("Rode a migração supabase/migration-expenses.sql no SQL Editor do Supabase.");
    }
    throw error;
  }
  return mapExpense(data);
}

export async function getExpense(id: string): Promise<Expense | null> {
  if (!hasSupabaseAdmin()) return null;
  const { data } = await createAdminClient().from("expenses").select("*").eq("id", id).maybeSingle();
  return data ? mapExpense(data) : null;
}

export async function deleteExpense(id: string): Promise<void> {
  assertPersistable();
  const admin = createAdminClient();
  const exp = await getExpense(id);
  const { error } = await admin.from("expenses").delete().eq("id", id);
  if (error) throw error;
  // apaga a imagem da nota junto (melhor esforço — o gasto já foi removido)
  if (exp?.receipt_path) await admin.storage.from(RECEIPT_BUCKET).remove([exp.receipt_path]).catch(() => {});
}

// --------------------------------------------------------------------------
//  Notas anexadas (bucket privado)
// --------------------------------------------------------------------------
export const RECEIPT_BUCKET = "expense-receipts";
const RECEIPT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const RECEIPT_TYPES = Object.keys(RECEIPT_EXT);

/** Guarda a imagem da nota no bucket privado e devolve o caminho. */
export async function uploadReceipt(bytes: Buffer, contentType: string): Promise<string> {
  assertPersistable();
  const ext = RECEIPT_EXT[contentType];
  if (!ext) throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
  const path = `receipts/${crypto.randomUUID()}.${ext}`;
  const { error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Rode a migração supabase/migration-expense-receipts.sql no SQL Editor do Supabase.");
    }
    throw new Error(`Falha ao salvar a nota: ${error.message}`);
  }
  return path;
}

/** Links temporários (1h) pra abrir as notas — o bucket é privado. path -> url. */
export async function signedReceiptUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!hasSupabaseAdmin() || paths.length === 0) return out;
  const { data } = await createAdminClient().storage.from(RECEIPT_BUCKET).createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  }
  return out;
}

/**
 * Copia as contas fixas do mês anterior pro mês `ym` (mesmo dia, ajustado ao
 * tamanho do mês), pulando as que já existem lá com a mesma descrição.
 * Devolve quantas foram criadas.
 */
export async function copyFixedFromPreviousMonth(ym: string, actorEmail: string | null): Promise<number> {
  assertPersistable();
  const [{ rows: prev }, { rows: current }] = await Promise.all([
    listExpensesForMonth(shiftMonth(ym, -1)),
    listExpensesForMonth(ym),
  ]);
  const have = new Set(current.filter((e) => e.category === "fixa").map((e) => e.description.toLowerCase()));
  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const toCreate = prev
    .filter((e) => e.category === "fixa" && !have.has(e.description.toLowerCase()))
    .map((e) => {
      const day = Math.min(Number(e.spent_on.slice(8, 10)), daysInMonth);
      return {
        spent_on: `${ym}-${String(day).padStart(2, "0")}`,
        category: "fixa",
        description: e.description,
        amount: e.amount,
        supplier: e.supplier,
        notes: e.notes,
        created_by: actorEmail,
      };
    });
  if (toCreate.length === 0) return 0;

  const { error } = await createAdminClient().from("expenses").insert(toCreate);
  if (error) throw error;
  return toCreate.length;
}
