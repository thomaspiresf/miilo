import { Banknote, Landmark, Wallet } from "lucide-react";
import { listAllOrders } from "@/lib/data/orders";
import { listAllExpenses } from "@/lib/data/expenses";
import { listCashEntries } from "@/lib/data/cash";
import { ACCOUNT_LABELS, KIND_LABELS, computeCash } from "@/lib/cash";
import { formatBRL, formatDate } from "@/lib/format";
import { todayBr } from "@/lib/expenses";
import { CashEntryDialog } from "@/components/admin/cash-entry-dialog";
import { CashEntryDelete } from "@/components/admin/cash-entry-delete";
import { cn } from "@/lib/utils";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatBRL(Math.abs(n))}`;

/** Caixa de hoje: dinheiro em mãos e saldo do Mercado Pago (líquido da taxa, já sem os investimentos pagos pela Miilo). */
export async function CashOverview() {
  const [orders, expenses, { rows: entries, tableMissing }] = await Promise.all([
    listAllOrders(),
    listAllExpenses(),
    listCashEntries(),
  ]);
  const s = computeCash(orders, expenses, entries);

  const cards = [
    { label: "Dinheiro", value: s.cash.total, Icon: Banknote, note: "em mãos (vendas na loja)" },
    { label: "Mercado Pago", value: s.mp.total, Icon: Wallet, note: "líquido da taxa, já sem os investimentos da Miilo" },
  ];

  return (
    <section aria-label="Caixa" className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold">Caixa hoje</h2>
        </div>
        <CashEntryDialog today={todayBr()} balances={{ cash: s.cash.total, mp: s.mp.total }} />
      </div>

      {tableMissing && (
        <p className="border-b border-border bg-warning/10 px-4 py-2.5 text-xs text-warning">
          Para registrar movimentações, rode <code>supabase/migration-cash-entries.sql</code> no SQL Editor do Supabase. Os saldos abaixo
          já funcionam sem isso.
        </p>
      )}

      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {cards.map(({ label, value, Icon, note }) => (
          <div key={label} className="px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-[22px]", value < 0 && "text-danger")}>{formatBRL(value)}</p>
            <p className="mt-0.5 text-[11px] text-muted">{note}</p>
          </div>
        ))}
        <div className="px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Total em caixa</p>
          <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-[22px]", s.total < 0 ? "text-danger" : "text-success")}>
            {formatBRL(s.total)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">dinheiro + Mercado Pago</p>
        </div>
      </div>

      <details className="group border-t border-border px-4 py-2.5 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted marker:hidden [&::-webkit-details-marker]:hidden">
          <span>Como foi calculado</span>
          <span className="group-open:hidden">ver</span>
          <span className="hidden group-open:inline">ocultar</span>
        </summary>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Mercado Pago</dt>
            <dd className="mt-1 space-y-0.5 text-muted">
              <p className="flex justify-between"><span>Vendas por Pix/cartão (líquido da taxa)</span><span className="tabular-nums text-foreground">{formatBRL(s.mp.sales)}</span></p>
              <p className="flex justify-between"><span>Investimentos pagos pela Miilo</span><span className="tabular-nums text-foreground">−{formatBRL(s.mp.expenses)}</span></p>
              <p className="flex justify-between"><span>Movimentações manuais</span><span className="tabular-nums text-foreground">{signed(s.mp.entries)}</span></p>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Dinheiro</dt>
            <dd className="mt-1 space-y-0.5 text-muted">
              <p className="flex justify-between"><span>Vendas em dinheiro/maquininha</span><span className="tabular-nums text-foreground">{formatBRL(s.cash.sales)}</span></p>
              <p className="flex justify-between"><span>Movimentações manuais</span><span className="tabular-nums text-foreground">{signed(s.cash.entries)}</span></p>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Só conta investimento marcado como pago pela <strong>Miilo (caixa da loja)</strong>. Se o saldo real for diferente (saldo
          inicial, taxas, estornos), use <strong>Registrar movimentação → Acertar saldo</strong>. Vendas antigas sem o valor líquido
          registrado entram pelo valor cheio.
        </p>
      </details>

      {entries.length > 0 && (
        <details className="group border-t border-border px-4 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted marker:hidden [&::-webkit-details-marker]:hidden">
            <span>Movimentações manuais ({entries.length})</span>
            <span className="group-open:hidden">ver</span>
            <span className="hidden group-open:inline">ocultar</span>
          </summary>
          <ul className="mt-2 divide-y divide-border text-[13px]">
            {entries.slice(0, 30).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {KIND_LABELS[e.kind]} · {ACCOUNT_LABELS[e.account]}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(`${e.occurred_on}T12:00:00-03:00`)}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 font-semibold tabular-nums", e.amount >= 0 ? "text-success" : "text-danger")}>{signed(e.amount)}</span>
                <CashEntryDelete id={e.id} label={`${KIND_LABELS[e.kind]} ${formatBRL(Math.abs(e.amount))}`} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
