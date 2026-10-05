import { listAllOrders } from "@/lib/data/orders";
import { listPricingRows } from "@/lib/data/pricing";
import { listAllExpenses } from "@/lib/data/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_ITEM_TYPES,
  EXPENSE_LABELS,
  EXPENSE_PAYERS,
  INVESTOR_PAYERS,
  ITEM_TYPE_LABELS,
  PAYER_LABELS,
  currentMonthBr,
  dateKeyBr,
  inPeriod,
  monthKeyBr,
  monthLabel,
  shiftMonth,
  type Period,
} from "@/lib/expenses";
import { formatBRL } from "@/lib/format";
import { amountDue, receivedSoFar } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { HealthChart, type HealthMonth } from "@/components/admin/health-chart";

const MAX_MONTHS = 12;
const OVERDUE_DAYS = 7;

const isOlderThanDays = (iso: string, days: number) =>
  Date.now() - new Date(iso).getTime() > days * 24 * 60 * 60 * 1000;

const isReceived = (status: string) => ["paid", "shipped", "delivered"].includes(status);

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
      <div
        className={cn("h-full rounded-full bg-primary/80", className)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  note?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl",
          tone === "good" && "text-success",
          tone === "bad" && "text-danger",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 truncate text-[11px] text-muted">{note}</p>}
    </div>
  );
}

/**
 * Saúde financeira da loja, no topo de /admin/gastos. Gasto, recebido e as quebras
 * seguem o período escolhido; "posição atual" (a receber, estoque, saldo geral) é
 * sempre a foto de hoje, desde o começo.
 */
export async function FinancialHealth({ period }: { period: Period }) {
  const [orders, expenses, { rows: pricing }] = await Promise.all([
    listAllOrders(),
    listAllExpenses(),
    listPricingRows(),
  ]);

  // ---- entradas -----------------------------------------------------------
  const paidOrders = orders.filter((o) => isReceived(o.status));
  const receivables = orders.filter((o) => o.channel === "pos" && o.status === "pending");
  // dinheiro já recebido: vendas pagas (líquido) + parte em dinheiro das vendas ainda pendentes (pagamento dividido)
  const receivedOrders = [...paidOrders, ...receivables.filter((o) => o.cash_paid > 0)];
  const receivable = receivables.reduce((s, o) => s + amountDue(o), 0);
  const overdue = receivables.filter((o) => isOlderThanDays(o.created_at, OVERDUE_DAYS));
  const overdueTotal = overdue.reduce((s, o) => s + amountDue(o), 0);

  // ---- foto de hoje (desde o começo) -------------------------------------
  const allReceived = receivedOrders.reduce((s, o) => s + receivedSoFar(o), 0);
  const allSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const stockCost = pricing.reduce((s, r) => s + r.stockCost, 0);
  const stockUnits = pricing.reduce((s, r) => s + r.stockUnits, 0);
  const productsWithoutCost = pricing.filter((r) => r.stockUnits > 0 && r.cost == null).length;
  const overall = allReceived + receivable + stockCost - allSpent;
  const allCash = allReceived - allSpent;

  // ---- período escolhido --------------------------------------------------
  const periodExpenses = expenses.filter((e) => inPeriod(e.spent_on, period));
  const periodReceivedOrders = receivedOrders.filter((o) => inPeriod(dateKeyBr(o.created_at), period));
  const spent = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const received = periodReceivedOrders.reduce((s, o) => s + receivedSoFar(o), 0);
  const cashResult = received - spent;
  // arredonda pra baixo enquanto o resultado é negativo (99,5% não vira "100%")
  const recoveredPct = spent > 0 ? (cashResult < 0 ? Math.floor : Math.round)((received / spent) * 100) : null;

  const status =
    allSpent === 0 && allReceived === 0
      ? { dot: "bg-border", title: "Sem dados ainda", text: "Lance gastos e registre vendas para ver a saúde da loja." }
      : allCash >= 0
        ? { dot: "bg-success", title: "No azul no caixa", text: "Tudo que já entrou cobre tudo que já saiu." }
        : overall >= 0
          ? {
              dot: "bg-warning",
              title: "Recuperando o investimento",
              text: `Já voltou ${Math.round((allReceived / allSpent) * 100)}% do que foi gasto (${Math.round(((allReceived + receivable + stockCost) / allSpent) * 100)}% contando estoque e a receber).`,
            }
          : {
              dot: "bg-danger",
              title: "Investimento ainda não recuperado",
              text: `Mesmo com estoque e a receber, faltam ${formatBRL(Math.abs(overall))} para empatar.`,
            };

  // ---- mês a mês (gráfico): últimos 12 meses, resultado acumulado desde o começo -------
  const current = currentMonthBr();
  const firstMonth =
    [...expenses.map((e) => e.spent_on.slice(0, 7)), ...receivedOrders.map((o) => monthKeyBr(o.created_at))].sort()[0] ??
    current;
  const allMonths: HealthMonth[] = [];
  let cum = 0;
  for (let ym = firstMonth; ym <= current && allMonths.length < 120; ym = shiftMonth(ym, 1)) {
    const out = expenses.filter((e) => e.spent_on.slice(0, 7) === ym).reduce((s, e) => s + e.amount, 0);
    const inn = receivedOrders
      .filter((o) => monthKeyBr(o.created_at) === ym)
      .reduce((s, o) => s + receivedSoFar(o), 0);
    cum += inn - out;
    allMonths.push({
      ym,
      inn,
      out,
      cum,
      active:
        (!period.from || ym >= period.from.slice(0, 7)) && (!period.to || ym <= period.to.slice(0, 7)),
    });
  }
  const chartMonths = allMonths.slice(-MAX_MONTHS);

  // ---- quebras dos gastos (do período) ------------------------------------
  const sum = (pred: (e: (typeof expenses)[number]) => boolean) =>
    periodExpenses.filter(pred).reduce((s, e) => s + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ label: EXPENSE_LABELS[c], amount: sum((e) => e.category === c) }));
  const byType = [
    ...EXPENSE_ITEM_TYPES.map((t) => ({ label: ITEM_TYPE_LABELS[t], amount: sum((e) => e.item_type === t) })),
    { label: "Sem tipo", amount: sum((e) => !e.item_type) },
  ].filter((r) => r.amount > 0);
  const byPayer = EXPENSE_PAYERS.map((p) => ({ payer: p, amount: sum((e) => e.payer === p) }));
  const noPayer = sum((e) => !e.payer);
  const [invA, invB] = INVESTOR_PAYERS;
  const amtA = byPayer.find((p) => p.payer === invA)?.amount ?? 0;
  const amtB = byPayer.find((p) => p.payer === invB)?.amount ?? 0;

  const alerts: string[] = [];
  if (overdue.length > 0)
    alerts.push(
      `${overdue.length} venda${overdue.length === 1 ? "" : "s"} a receber há mais de ${OVERDUE_DAYS} dias (${formatBRL(overdueTotal)})`,
    );
  if (noPayer > 0) alerts.push(`${formatBRL(noPayer)} em gastos sem “quem pagou” neste período`);
  if (productsWithoutCost > 0)
    alerts.push(
      `${productsWithoutCost} produto${productsWithoutCost === 1 ? "" : "s"} em estoque sem custo cadastrado (estoque subestimado)`,
    );

  const breakdowns = [
    { title: "Por categoria", items: byCategory },
    { title: "Por tipo", items: byType },
  ];

  return (
    <section aria-label="Saúde financeira" className="space-y-4">
      {/* situação geral — uma linha, sem alarde */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-semibold">
          <span className={cn("h-2 w-2 rounded-full", status.dot)} />
          {status.title}
        </span>
        <span className="text-muted">{status.text}</span>
      </div>

      {/* números */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <p className="border-b border-border bg-black/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {period.label}
        </p>
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Gasto" value={formatBRL(spent)} />
          <Stat label="Recebido" value={formatBRL(received)} note="líquido da taxa" />
          <Stat label="Resultado" value={formatBRL(cashResult)} tone={cashResult >= 0 ? "good" : "bad"} />
          <Stat
            label="Voltou do gasto"
            value={recoveredPct != null ? `${recoveredPct}%` : "—"}
            note="recebido ÷ gasto"
          />
        </div>
        <p className="border-y border-border bg-black/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Posição hoje <span className="font-normal normal-case tracking-normal">· desde o começo, não muda com o período</span>
        </p>
        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat label="A receber" value={formatBRL(receivable)} note="vendas na loja" />
          <Stat
            label="Estoque a custo"
            value={formatBRL(stockCost)}
            note={`${stockUnits} peça${stockUnits === 1 ? "" : "s"}`}
          />
          <Stat label="Saldo geral" value={formatBRL(overall)} tone={overall >= 0 ? "good" : "bad"} note="caixa + a receber + estoque" />
        </div>
      </div>

      {alerts.length > 0 && (
        <details className="group rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-muted marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span className="font-medium text-foreground/80">
              {alerts.length} ponto{alerts.length === 1 ? "" : "s"} de atenção
            </span>
            <span className="ml-auto text-xs group-open:hidden">ver</span>
            <span className="ml-auto hidden text-xs group-open:inline">ocultar</span>
          </summary>
          <ul className="mt-2 space-y-1 border-t border-border pt-2 text-[13px] text-muted">
            {alerts.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                {a}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Saúde financeira mês a mês</p>
          <p className="text-[11px] text-muted">últimos {chartMonths.length} {chartMonths.length === 1 ? "mês" : "meses"}</p>
        </div>
        <div className="mt-3">
          <HealthChart months={chartMonths} hrefBase="/admin/gastos?periodo=" />
        </div>
        <details className="group mt-3 border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted marker:hidden [&::-webkit-details-marker]:hidden">
            <span>Ver os números</span>
            <span className="group-open:hidden">mostrar</span>
            <span className="hidden group-open:inline">ocultar</span>
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-1.5 font-medium">Mês</th>
                  <th className="py-1.5 text-right font-medium">Recebido</th>
                  <th className="py-1.5 text-right font-medium">Gasto</th>
                  <th className="py-1.5 text-right font-medium">Resultado</th>
                  <th className="py-1.5 text-right font-medium">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...chartMonths].reverse().map((m) => (
                  <tr key={m.ym}>
                    <td className="py-1.5 first-letter:uppercase">{monthLabel(m.ym)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatBRL(m.inn)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatBRL(m.out)}</td>
                    <td className={cn("py-1.5 text-right font-medium tabular-nums", m.inn - m.out >= 0 ? "text-success" : "text-danger")}>
                      {formatBRL(m.inn - m.out)}
                    </td>
                    <td className={cn("py-1.5 text-right tabular-nums", m.cum >= 0 ? "text-success" : "text-danger")}>
                      {formatBRL(m.cum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {breakdowns.map((block) => (
          <div key={block.title} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold">{block.title}</p>
            <div className="mt-3 space-y-3">
              {block.items.length === 0 || spent === 0 ? (
                <p className="text-sm text-muted">Nenhum gasto neste período.</p>
              ) : (
                block.items.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-[13px]">
                      <span>{r.label}</span>
                      <span className="tabular-nums">
                        {formatBRL(r.amount)}
                        <span className="ml-2 text-xs text-muted">{Math.round((r.amount / spent) * 100)}%</span>
                      </span>
                    </div>
                    <Bar pct={(r.amount / spent) * 100} />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold">Quem pagou</p>
        <div className="mt-3 space-y-3">
          {byPayer.map(({ payer, amount }) => (
            <div key={payer}>
              <div className="flex justify-between text-[13px]">
                <span>{PAYER_LABELS[payer]}</span>
                <span className="tabular-nums">
                  {formatBRL(amount)}
                  <span className="ml-2 text-xs text-muted">{spent > 0 ? Math.round((amount / spent) * 100) : 0}%</span>
                </span>
              </div>
              <Bar pct={spent > 0 ? (amount / spent) * 100 : 0} className={payer === "miilo" ? "bg-muted" : undefined} />
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          {amtA === 0 && amtB === 0
            ? "Nenhum dos núcleos pagou gastos neste período."
            : amtA === amtB
            ? "Os dois núcleos investiram o mesmo valor neste período."
            : `${PAYER_LABELS[amtA > amtB ? invA : invB]} investiu ${formatBRL(Math.abs(amtA - amtB))} a mais que ${PAYER_LABELS[amtA > amtB ? invB : invA]} neste período.`}
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        “Recebido” conta só vendas pagas (líquido da taxa do Mercado Pago) e a parte já recebida em dinheiro de vendas
        divididas. “Saldo geral” soma o que entrou, o a receber e o estoque ao custo, menos tudo que foi gasto: é uma
        estimativa, não um balanço contábil. Estoque sem custo cadastrado conta como zero.
      </p>
    </section>
  );
}
