"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { expenseInputSchema } from "@/lib/expense-schema";
import { copyFixedFromPreviousMonth, createExpense, deleteExpense, getExpense } from "@/lib/data/expenses";
import { EXPENSE_LABELS, isMonthKey } from "@/lib/expenses";
import { logAction } from "@/lib/data/audit";
import { formatBRL } from "@/lib/format";

export async function createExpenseAction(_prev: unknown, formData: FormData) {
  await requireAdmin();

  const parsed = expenseInputSchema.safeParse({
    spentOn: formData.get("spentOn") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    amount: formData.get("amount") ?? "",
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
      summary: `Lançou gasto: ${exp.description} — ${formatBRL(exp.amount)} (${EXPENSE_LABELS[exp.category]})`,
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
