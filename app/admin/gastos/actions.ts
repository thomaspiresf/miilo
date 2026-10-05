"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { expenseInputSchema } from "@/lib/expense-schema";
import { copyFixedFromPreviousMonth, createExpense, deleteExpense, getExpense, setExpenseItemType, setExpensePayer } from "@/lib/data/expenses";
import { EXPENSE_LABELS, EXPENSE_ITEM_TYPES, EXPENSE_PAYERS, ITEM_TYPE_LABELS, PAYER_LABELS, isMonthKey, type ExpenseItemType, type ExpensePayer } from "@/lib/expenses";
import { logAction } from "@/lib/data/audit";
import { formatBRL } from "@/lib/format";
import { syncMetaSpend, type SyncLine } from "@/lib/meta-sync";

export async function createExpenseAction(_prev: unknown, formData: FormData) {
  await requireAdmin();

  const parsed = expenseInputSchema.safeParse({
    spentOn: formData.get("spentOn") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    amount: formData.get("amount") ?? "",
    payer: formData.get("payer") ?? "",
    itemType: formData.get("itemType") ?? "",
    supplier: formData.get("supplier") ?? "",
    notes: formData.get("notes") ?? "",
    receiptPath: formData.get("receiptPath") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const actor = await currentActor();
    const exp = await createExpense(parsed.data, actor.email);
    await logAction({
      action: "expense.create",
      entity: "expense",
      entityId: exp.id,
      summary: `Lançou gasto: ${exp.description} — ${formatBRL(exp.amount)} (${EXPENSE_LABELS[exp.category]}, pago por ${exp.payer ? PAYER_LABELS[exp.payer] : "—"})`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao salvar o gasto" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}

export async function deleteExpenseAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const exp = await getExpense(id);
    await deleteExpense(id);
    await logAction({
      action: "expense.delete",
      entity: "expense",
      summary: exp
        ? `Apagou gasto: ${exp.description} — ${formatBRL(exp.amount)}`
        : "Apagou um gasto",
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao apagar" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}

export async function copyFixedAction(ym: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  await requireAdmin();
  if (!isMonthKey(ym)) return { ok: false, error: "Mês inválido." };
  try {
    const actor = await currentActor();
    const count = await copyFixedFromPreviousMonth(ym, actor.email);
    if (count > 0) {
      await logAction({
        action: "expense.create",
        entity: "expense",
        summary: `Copiou ${count} conta${count === 1 ? "" : "s"} fixa${count === 1 ? "" : "s"} do mês anterior (${ym})`,
      });
    }
    revalidatePath("/admin/gastos");
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao copiar" };
  }
}

export async function setExpensePayerAction(id: string, payer: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!(EXPENSE_PAYERS as readonly string[]).includes(payer)) return { ok: false, error: "Pagador inválido." };
  try {
    const exp = await getExpense(id);
    await setExpensePayer(id, payer as ExpensePayer);
    await logAction({
      action: "expense.update",
      entity: "expense",
      entityId: id,
      summary: `Definiu quem pagou: ${exp?.description ?? "gasto"} → ${PAYER_LABELS[payer as ExpensePayer]}`,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao salvar" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}

export async function setExpenseItemTypeAction(id: string, itemType: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const value = itemType === "" ? null : itemType;
  if (value !== null && !(EXPENSE_ITEM_TYPES as readonly string[]).includes(value)) {
    return { ok: false, error: "Tipo inválido." };
  }
  try {
    const exp = await getExpense(id);
    await setExpenseItemType(id, value as ExpenseItemType | null);
    await logAction({
      action: "expense.update",
      entity: "expense",
      entityId: id,
      summary: `Classificou gasto: ${exp?.description ?? "gasto"} → ${value ? ITEM_TYPE_LABELS[value as ExpenseItemType] : "sem tipo"}`,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao salvar" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}

/** Busca agora os custos da Meta (WhatsApp e anúncios) e atualiza as linhas automáticas de Gastos. */
export async function syncMetaSpendAction(): Promise<{ lines: SyncLine[] }> {
  await requireAdmin();
  const lines = await syncMetaSpend();
  if (lines.some((l) => l.status === "ok")) {
    await logAction({
      action: "expense.sync",
      entity: "expense",
      summary: `Sincronizou custos da Meta: ${lines.map((l) => `${l.label} — ${l.message}`).join(" · ")}`,
    });
    revalidatePath("/admin/gastos");
  }
  return { lines };
}
