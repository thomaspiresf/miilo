import type { Order } from "@/lib/types";
import type { Expense } from "@/lib/expenses";
import { cashPaidOf } from "@/lib/order-utils";

/** Regras puras do caixa: dinheiro em mãos × conta do Mercado Pago. */

export type CashAccount = "cash" | "mp";
export type CashEntryKind = "entrada" | "saida" | "transferencia" | "ajuste";

export type CashEntry = {
  id: string;
  occurred_on: string; // YYYY-MM-DD
  account: CashAccount;
  amount: number; // + entra, − sai
  kind: CashEntryKind;
  note: string | null;
  group_id: string | null;
  created_by: string | null;
  created_at: string;
};

export const ACCOUNT_LABELS: Record<CashAccount, string> = { cash: "Dinheiro", mp: "Mercado Pago" };
export const KIND_LABELS: Record<CashEntryKind, string> = {
  entrada: "Entrada",
  saida: "Retirada",
  transferencia: "Transferência",
  ajuste: "Ajuste de saldo",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const PAID = ["paid", "shipped", "delivered"];

/**
 * Pra onde foi o dinheiro de uma venda: parte em dinheiro/maquininha (fica em mãos) e parte no
 * Mercado Pago (Pix/cartão, já líquido da taxa). Venda na loja pendente conta só a entrada em dinheiro.
 */
export function orderCashSplit(o: Order): { cash: number; mp: number } {
  const paid = PAID.includes(o.status);
  if (!paid) return { cash: o.channel === "pos" && o.status === "pending" ? cashPaidOf(o) : 0, mp: 0 };

  const method = (o.payment_method ?? "").toLowerCase();
  const gross = o.net_amount ?? o.total;
  const cashPart = cashPaidOf(o);
  const isCashMethod =
    method.includes("dinheiro") || method.includes("cash") || method === "manual" || (!method && o.channel === "pos" && !o.mp_payment_id);

  if (method.includes("+")) return { cash: cashPart, mp: round2(Math.max(0, gross - cashPart)) }; // "dinheiro + pix"
  if (isCashMethod) return { cash: o.total, mp: 0 };
  return { cash: cashPart, mp: round2(Math.max(0, gross - cashPart)) };
}

export type CashSummary = {
  cash: { sales: number; entries: number; total: number };
  mp: { sales: number; expenses: number; entries: number; total: number };
  total: number;
};

/**
 * Saldo de cada conta:
 *  - Dinheiro  = vendas recebidas em dinheiro/maquininha + movimentações manuais da conta
 *  - Mercado Pago = vendas líquidas da taxa − investimentos pagos pela Miilo + movimentações manuais
 */
export function computeCash(orders: Order[], expenses: Expense[], entries: CashEntry[]): CashSummary {
  let cashSales = 0;
  let mpSales = 0;
  for (const o of orders) {
    const s = orderCashSplit(o);
    cashSales += s.cash;
    mpSales += s.mp;
  }
  const mpExpenses = expenses.filter((e) => e.payer === "miilo").reduce((s, e) => s + e.amount, 0);
  const sumEntries = (acc: CashAccount) => entries.filter((e) => e.account === acc).reduce((s, e) => s + e.amount, 0);
  const cashEntries = sumEntries("cash");
  const mpEntries = sumEntries("mp");

  const cash = { sales: round2(cashSales), entries: round2(cashEntries), total: round2(cashSales + cashEntries) };
  const mp = {
    sales: round2(mpSales),
    expenses: round2(mpExpenses),
    entries: round2(mpEntries),
    total: round2(mpSales - mpExpenses + mpEntries),
  };
  return { cash, mp, total: round2(cash.total + mp.total) };
}
