import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAllOrders } from "@/lib/data/orders";
import { listExpensesForMonth } from "@/lib/data/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LABELS,
  currentMonthBr,
  isMonthKey,
  monthLabel,
  monthRange,
  shiftMonth,
  todayBr,
} from "@/lib/expenses";
import { formatBRL, formatDate } from "@/lib/format";
import { ExpenseForm } from "@/components/admin/expense-form";
import { CopyFixedButton, DeleteExpenseButton } from "@/components/admin/expense-row-actions";
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

  const [{ rows, tableMissing }, prevMonth, orders] = await Promise.all([
    listExpensesForMonth(ym),
    listExpensesForMonth(prevYm),
    listAllOrders(),
  ]);

  // "Recebido" igual ao do Painel: pedidos pagos, já descontada a taxa do MP quando conhecida
  const { from, to } = monthRange(ym);
  const received = orders
    .filter((o) => ["paid", "shipped", "delivered"].includes(o.status))
    .filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= from.getTime() && t < to.getTime();
    })
    .reduce((s, o) => s + (o.net_amount ?? o.total), 0);

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const result = received - total;
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    amount: rows.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
  }));

  const haveFixed = new Set(rows.filter((e) => e.category === "fixa").map((e) => e.description.toLowerCase()));
  const missingFixed = prevMonth.rows.filter(
    (e) => e.category === "fixa" && !haveFixed.has(e.description.toLowerCase()),
  ).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Controle de gastos</h1>
          <p className="mt-1 text-sm text-muted">
            Lance o que saiu do caixa e compare com o que entrou no mês.
          </p>
        </div>
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

      {missingFixed > 0 && <CopyFixedButton month={ym} count={missingFixed} />}

      <ExpenseForm today={todayBr()} />

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhum gasto lançado em {monthLabel(ym)}.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.description}</p>
                <p className="text-xs text-muted">
                  {formatDate(`${e.spent_on}T12:00:00-03:00`)} · {EXPENSE_LABELS[e.category]}
                  {e.supplier ? ` · ${e.supplier}` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-bold tabular-nums">{formatBRL(e.amount)}</span>
              <DeleteExpenseButton id={e.id} description={e.description} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
