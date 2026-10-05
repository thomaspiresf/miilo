"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { computeCash, ACCOUNT_LABELS, type CashAccount } from "@/lib/cash";
import { createCashEntries, deleteCashEntry, listCashEntries, type NewCashEntry } from "@/lib/data/cash";
import { listAllOrders } from "@/lib/data/orders";
import { listAllExpenses } from "@/lib/data/expenses";
import { logAction } from "@/lib/data/audit";
import { formatBRL, parseMoney } from "@/lib/format";
import { todayBr } from "@/lib/expenses";

export type CashMovementInput = {
  mode: "ajuste" | "entrada" | "saida" | "transferencia";
  account: CashAccount;
  /** só em transferência: conta de destino (a de origem é `account`) */
  to?: CashAccount;
  amount: string;
  date: string;
  note: string;
};

/** Registra uma movimentação do caixa: acerto de saldo, entrada, retirada ou transferência entre contas. */
export async function createCashMovementAction(
  input: CashMovementInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const accounts: CashAccount[] = ["cash", "mp"];
  if (!accounts.includes(input.account)) return { ok: false, error: "Conta inválida." };
  const value = parseMoney(input.amount);
  if (value == null || value < 0 || (input.mode !== "ajuste" && value <= 0)) {
    return { ok: false, error: input.mode === "ajuste" ? "Informe o saldo atual (0 ou mais)." : "Informe um valor maior que zero." };
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayBr();
  const note = input.note.trim().slice(0, 200) || null;

  const entries: NewCashEntry[] = [];
  let summary = "";
  try {
    if (input.mode === "ajuste") {
      const [orders, expenses, { rows }] = await Promise.all([listAllOrders(), listAllExpenses(), listCashEntries()]);
      const s = computeCash(orders, expenses, rows);
      const current = input.account === "cash" ? s.cash.total : s.mp.total;
      const diff = Math.round((value - current) * 100) / 100;
      if (Math.abs(diff) < 0.005) return { ok: false, error: "O saldo já está nesse valor." };
      entries.push({ occurred_on: date, account: input.account, amount: diff, kind: "ajuste", note: note ?? "Acerto de saldo" });
      summary = `Acertou o saldo de ${ACCOUNT_LABELS[input.account]} para ${formatBRL(value)} (ajuste de ${formatBRL(diff)})`;
    } else if (input.mode === "entrada") {
      entries.push({ occurred_on: date, account: input.account, amount: value, kind: "entrada", note });
      summary = `Entrada de ${formatBRL(value)} em ${ACCOUNT_LABELS[input.account]}`;
    } else if (input.mode === "saida") {
      entries.push({ occurred_on: date, account: input.account, amount: -value, kind: "saida", note });
      summary = `Retirada de ${formatBRL(value)} de ${ACCOUNT_LABELS[input.account]}`;
    } else {
      const to = input.to;
      if (!to || !accounts.includes(to) || to === input.account) return { ok: false, error: "Escolha duas contas diferentes." };
      const group = crypto.randomUUID();
      entries.push(
        { occurred_on: date, account: input.account, amount: -value, kind: "transferencia", note, group_id: group },
        { occurred_on: date, account: to, amount: value, kind: "transferencia", note, group_id: group },
      );
      summary = `Transferiu ${formatBRL(value)} de ${ACCOUNT_LABELS[input.account]} para ${ACCOUNT_LABELS[to]}`;
    }
    const actor = await currentActor();
    await createCashEntries(entries, actor.email);
    await logAction({ action: "cash.entry", entity: "expense", summary });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao salvar" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}

export async function deleteCashEntryAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await deleteCashEntry(id);
    await logAction({ action: "cash.entry_delete", entity: "expense", summary: "Apagou uma movimentação do caixa" });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao apagar" };
  }
  revalidatePath("/admin/gastos");
  return { ok: true };
}
