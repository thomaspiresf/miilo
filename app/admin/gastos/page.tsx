import Link from "next/link";
import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAllOrders } from "@/lib/data/orders";
import { listExpensesForMonth, signedReceiptUrls, totalsByPayer } from "@/lib/data/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LABELS,
  EXPENSE_ITEM_TYPES,
  EXPENSE_PAYERS,
  INVESTOR_PAYERS,
  ITEM_TYPE_LABELS,
  PAYER_LABELS,
  currentMonthBr,
  isMonthKey,
  monthLabel,
  monthRange,
  shiftMonth,
  todayBr,
} from "@/lib/expenses";
import { formatBRL, formatDate } from "@/lib/format";
import { receivedSoFar } from "@/lib/order-utils";
import { AddExpenseDialog } from "@/components/admin/add-expense-dialog";
import { FinancialHealth } from "@/components/admin/financial-health";
import { CopyFixedButton, DeleteExpenseButton, ItemTypeSelect, PayerSelect } from "@/components/admin/expense-row-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gastos" };

const BAR_COLORS: Record<string, string> = {
  mercadoria: "bg-accent",
  fixa: "bg-warning",
  marketing: "bg-pink",
  outros: "bg-muted",
};

export default async function AdminExpensesPage(props: PageProps<"/admin/gastos">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const current = currentMonthBr();
  const ym = isMonthKey(sp.mes) ? sp.mes : current;
  const prevYm = shiftMonth(ym, -1);

  const [{ rows, tableMissing }, prevMonth, orders, allTime] = await Promise.all([
    listExpensesForMonth(ym),
    listExpensesForMonth(prevYm),
    listAllOrders(),
    totalsByPayer(),
  ]);

  // "Recebido" igual ao do Painel: pedidos pagos, já descontada a taxa do MP quando conhecida
  const { from, to } = monthRange(ym);
  const received = orders
    .filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= from.getTime() && t < to.getTime();
    })
    .reduce((s, o) => s + receivedSoFar(o), 0);

  const receiptUrls = await signedReceiptUrls(rows.flatMap((e) => (e.receipt_path ? [e.receipt_path] : [])));

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const result = received - total;
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    amount: rows.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
  }));

  const monthByPayer = (p: (typeof EXPENSE_PAYERS)[number]) =>
    rows.filter((e) => e.payer === p).reduce((s, e) => s + e.amount, 0);
  const monthNoPayer = rows.filter((e) => !e.payer).reduce((s, e) => s + e.amount, 0);
  const allNoPayer = allTime.get(null) ?? 0;
  const [investA, investB] = INVESTOR_PAYERS;
  const allA = allTime.get(investA) ?? 0;
  const allB = allTime.get(investB) ?? 0;
  const monthA = monthByPayer(investA);
  const monthB = monthByPayer(investB);
  const gap = (a: number, b: number) =>
    a === b
      ? "Empatados."
      : `${PAYER_LABELS[a > b ? investA : investB]} investiu ${formatBRL(Math.abs(a - b))} a mais.`;

  const byItemType = [...EXPENSE_ITEM_TYPES, null].map((t) => ({
    type: t,
    amount: rows.filter((e) => e.item_type === t).reduce((s, e) => s + e.amount, 0),
  }));

  const haveFixed = new Set(rows.filter((e) => e.category === "fixa").map((e) => e.description.toLowerCase()));
  const missingFixed = prevMonth.rows.filter(
    (e) => e.category === "fixa" && !haveFixed.has(e.description.toLowerCase()),
  ).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Gastos e saúde financeira</h1>
          <p className="mt-1 text-sm text-muted">
            Como a loja está desde o começo e o detalhe de cada mês.
          </p>
        </div>
        <AddExpenseDialog today={todayBr()} />
      </div>

      {!tableMissing && <FinancialHealth />}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-6">
        <h2 className="text-xl font-black">Detalhe do mês</h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm font-semibold">
          <Link
            href={`/admin/gastos?mes=${prevYm}`}
            aria-label="Mês anterior"
            className="rounded-full p-1.5 hover:bg-black/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center first-letter:uppercase">{monthLabel(ym)}</span>
          {ym < current ? (
            <Link
              href={`/admin/gastos?mes=${shiftMonth(ym, 1)}`}
              aria-label="Próximo mês"
              className="rounded-full p-1.5 hover:bg-black/5"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="p-1.5 text-border">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      {tableMissing && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          A tabela de gastos ainda não existe no banco. Rode o arquivo{" "}
          <code>supabase/migration-expenses.sql</code> no SQL Editor do Supabase e recarregue.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">Gasto no mês</p>
          <p className="mt-1 text-2xl font-black">{formatBRL(total)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">Recebido no mês</p>
          <p className="mt-1 text-2xl font-black">{formatBRL(received)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">Resultado (recebido − gasto)</p>
          <p className={cn("mt-1 text-2xl font-black", result >= 0 ? "text-success" : "text-danger")}>
            {formatBRL(result)}
          </p>
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Visão de caixa: compara o que entrou (líquido da taxa do Mercado Pago) com o que você lançou como
        gasto no mês. Vendas &quot;a receber&quot; só contam quando forem pagas.
      </p>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <p className="font-bold">Por categoria</p>
        {byCategory.map(({ category, amount }) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={category}>
              <div className="flex justify-between text-sm">
                <span>{EXPENSE_LABELS[category]}</span>
                <span className="font-semibold tabular-nums">
                  {formatBRL(amount)}
                  <span className="ml-2 text-xs font-normal text-muted">{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className={cn("h-full rounded-full", BAR_COLORS[category])} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <p className="font-bold">Por tipo</p>
        {byItemType
          .filter(({ type, amount }) => type !== null || amount > 0)
          .map(({ type, amount }) => {
            const pct = total > 0 ? (amount / total) * 100 : 0;
            return (
              <div key={type ?? "none"}>
                <div className="flex justify-between text-sm">
                  <span className={type ? "" : "text-muted"}>{type ? ITEM_TYPE_LABELS[type] : "Sem tipo"}</span>
                  <span className="font-semibold tabular-nums">
                    {formatBRL(amount)}
                    <span className="ml-2 text-xs font-normal text-muted">{Math.round(pct)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="font-bold">Quem pagou</p>
          <p className="text-xs text-muted">
            Gastos pagos por cada núcleo de sócios e pelo caixa da Miilo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-semibold">&nbsp;</th>
                <th className="pb-2 text-right font-semibold first-letter:uppercase">{monthLabel(ym)}</th>
                <th className="pb-2 text-right font-semibold">Total acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EXPENSE_PAYERS.map((p) => (
                <tr key={p}>
                  <td className="py-2 font-semibold">{PAYER_LABELS[p]}</td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(monthByPayer(p))}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{formatBRL(allTime.get(p) ?? 0)}</td>
                </tr>
              ))}
              {(monthNoPayer > 0 || allNoPayer > 0) && (
                <tr className="text-muted">
                  <td className="py-2">Sem informação (lançados antes)</td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(monthNoPayer)}</td>
                  <td className="py-2 text-right tabular-nums">{formatBRL(allNoPayer)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold">Investimento dos sócios (acumulado)</p>
          {INVESTOR_PAYERS.map((p) => {
            const value = allTime.get(p) ?? 0;
            const pct = allA + allB > 0 ? (value / (allA + allB)) * 100 : 0;
            return (
              <div key={p}>
                <div className="flex justify-between text-sm">
                  <span>{PAYER_LABELS[p]}</span>
                  <span className="font-semibold tabular-nums">
                    {formatBRL(value)}
                    <span className="ml-2 text-xs font-normal text-muted">{Math.round(pct)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted">
            Acumulado: {gap(allA, allB)} No mês: {gap(monthA, monthB)}
          </p>
        </div>
      </div>

      {missingFixed > 0 && <CopyFixedButton month={ym} count={missingFixed} />}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhum gasto lançado em {monthLabel(ym)}.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.description}</p>
                <p className="text-xs text-muted">
                  {formatDate(`${e.spent_on}T12:00:00-03:00`)} · {EXPENSE_LABELS[e.category]}
                  {e.supplier ? ` · ${e.supplier}` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              {e.receipt_path && receiptUrls.get(e.receipt_path) && (
                <a
                  href={receiptUrls.get(e.receipt_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Ver nota
                </a>
              )}
              <ItemTypeSelect id={e.id} itemType={e.item_type} />
              <PayerSelect id={e.id} payer={e.payer} />
              <span className="shrink-0 font-bold tabular-nums">{formatBRL(e.amount)}</span>
              <DeleteExpenseButton id={e.id} description={e.description} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
