import { Paperclip } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAllOrders } from "@/lib/data/orders";
import { listAllExpenses, listExpensesForMonth, signedReceiptUrls } from "@/lib/data/expenses";
import {
  EXPENSE_LABELS,
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
import { ExpenseIcon } from "@/components/admin/expense-icon";
import { MetaSyncButton } from "@/components/admin/meta-sync-button";
import { FinancialHealth } from "@/components/admin/financial-health";
import { CopyFixedButton, DeleteExpenseButton, ItemTypeSelect, PayerSelect } from "@/components/admin/expense-row-actions";

export const metadata = { title: "Investimentos" };

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
          <h1 className="text-2xl font-black">Investimentos e saúde financeira</h1>
          <p className="mt-1 text-sm text-muted">Quanto saiu, quanto entrou e como a loja está.</p>
        </div>
        <div className="flex items-start gap-2">
          <PeriodFilter
            label={period.label}
            periodKey={period.key}
            month={shownMonth}
            months={monthOptions}
            from={customFrom}
            to={customTo}
            today={today}
          />
          <MetaSyncButton />
          <AddExpenseDialog today={today} />
        </div>
      </div>

      {tableMissing && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          A tabela de investimentos ainda não existe no banco. Rode o arquivo{" "}
          <code>supabase/migration-expenses.sql</code> no SQL Editor do Supabase e recarregue.
        </p>
      )}

      {!tableMissing && <FinancialHealth period={period} />}

      {missingFixed > 0 && <CopyFixedButton month={currentMonthBr()} count={missingFixed} />}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Lançamentos</h2>
          <p className="text-xs text-muted">
            {period.label} · {rows.length} investimento{rows.length === 1 ? "" : "s"} · {formatBRL(total)}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Nenhum investimento lançado neste período.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {rows.map((e) => {
              const receiptUrl = e.receipt_path ? receiptUrls.get(e.receipt_path) : undefined;
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3.5">
                  <ExpenseIcon expense={e} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 truncate text-[15px] font-semibold leading-tight">{e.description}</p>
                      {e.source && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          automático
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(`${e.spent_on}T12:00:00-03:00`)}
                      <span className="mx-1.5 text-border">•</span>
                      {EXPENSE_LABELS[e.category]}
                      {e.supplier && (
                        <>
                          <span className="mx-1.5 text-border">•</span>
                          {e.supplier}
                        </>
                      )}
                    </p>
                    {e.notes && <p className="mt-1 text-xs italic text-muted">“{e.notes}”</p>}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <PayerSelect id={e.id} payer={e.payer} />
                      <ItemTypeSelect id={e.id} itemType={e.item_type} />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-base font-bold tabular-nums">{formatBRL(e.amount)}</span>
                    <div className="flex items-center gap-0.5">
                      {receiptUrl && (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver nota"
                          aria-label="Ver nota"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          <Paperclip className="h-3.5 w-3.5" /> Nota
                        </a>
                      )}
                      <DeleteExpenseButton id={e.id} description={e.description} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
