import { Paperclip } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAllOrders } from "@/lib/data/orders";
import { listAllExpenses, listExpensesForMonth, signedReceiptUrls } from "@/lib/data/expenses";
import {
  EXPENSE_LABELS,
  PAYER_LABELS,
  currentMonthBr,
  inPeriod,
  resolvePeriod,
  monthKeyBr,
  monthLabel,
  shiftMonth,
  todayBr,
  addDays,
} from "@/lib/expenses";
import { formatBRL, formatDate } from "@/lib/format";
import { PeriodFilter } from "@/components/admin/period-filter";
import { AddExpenseDialog } from "@/components/admin/add-expense-dialog";
import { FinancialHealth } from "@/components/admin/financial-health";
import { CopyFixedButton, DeleteExpenseButton, ItemTypeSelect, PayerSelect } from "@/components/admin/expense-row-actions";

export const metadata = { title: "Gastos" };

export default async function AdminExpensesPage(props: PageProps<"/admin/gastos">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const period = resolvePeriod(sp);
  const today = todayBr();

  const [all, thisMonth] = await Promise.all([
    listAllExpenses(),
    period.key === "mes" ? listExpensesForMonth(currentMonthBr()) : null,
  ]);
  const tableMissing =
    all.length === 0 ? (thisMonth ?? (await listExpensesForMonth(currentMonthBr()))).tableMissing : false;
  const rows = all.filter((e) => inPeriod(e.spent_on, period));
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const receiptUrls = await signedReceiptUrls(rows.flatMap((e) => (e.receipt_path ? [e.receipt_path] : [])));

  // "copiar contas fixas do mês anterior" só faz sentido olhando o mês atual
  let missingFixed = 0;
  if (period.key === "mes" && thisMonth) {
    const prev = await listExpensesForMonth(shiftMonth(currentMonthBr(), -1));
    const haveFixed = new Set(thisMonth.rows.filter((e) => e.category === "fixa").map((e) => e.description.toLowerCase()));
    missingFixed = prev.rows.filter((e) => e.category === "fixa" && !haveFixed.has(e.description.toLowerCase())).length;
  }

  const currentYm = currentMonthBr();
  const shownMonth = period.month ?? null;

  // meses disponíveis no seletor: do primeiro movimento (gasto ou venda) até o mês atual
  const orders = await listAllOrders();
  const firstMonth =
    [...all.map((e) => e.spent_on.slice(0, 7)), ...orders.map((o) => monthKeyBr(o.created_at))].sort()[0] ?? currentYm;
  const monthOptions: { ym: string; label: string }[] = [];
  for (let ym = currentYm; ym >= firstMonth && monthOptions.length < 60; ym = shiftMonth(ym, -1)) {
    monthOptions.push({ ym, label: monthLabel(ym).replace(/^./, (c) => c.toUpperCase()) });
  }
  const customFrom = period.key === "custom" && period.from ? period.from : addDays(today, -29);
  const customTo = period.key === "custom" && period.to ? period.to : today;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Gastos e saúde financeira</h1>
          <p className="mt-1 text-sm text-muted">Quanto saiu, quanto entrou e como a loja está.</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter
            label={period.label}
            periodKey={period.key}
            month={shownMonth}
            months={monthOptions}
            from={customFrom}
            to={customTo}
            today={today}
          />
          <AddExpenseDialog today={today} />
        </div>
      </div>

      {tableMissing && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          A tabela de gastos ainda não existe no banco. Rode o arquivo{" "}
          <code>supabase/migration-expenses.sql</code> no SQL Editor do Supabase e recarregue.
        </p>
      )}

      {!tableMissing && <FinancialHealth period={period} />}

      {missingFixed > 0 && <CopyFixedButton month={currentMonthBr()} count={missingFixed} />}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Lançamentos</h2>
          <p className="text-xs text-muted">
            {period.label} · {rows.length} gasto{rows.length === 1 ? "" : "s"} · {formatBRL(total)}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Nenhum gasto lançado neste período.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {rows.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(`${e.spent_on}T12:00:00-03:00`)} · {EXPENSE_LABELS[e.category]}
                    {e.payer ? ` · ${PAYER_LABELS[e.payer]}` : ""}
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
    </div>
  );
}
