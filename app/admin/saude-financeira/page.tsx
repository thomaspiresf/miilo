import Link from "next/link";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
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
  monthKeyBr,
  monthLabel,
  shiftMonth,
} from "@/lib/expenses";
import { formatBRL } from "@/lib/format";
import { amountDue, receivedSoFar } from "@/lib/order-utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Saúde financeira" };

const MONTHS_SHOWN = 6;
const OVERDUE_DAYS = 7;

const isOlderThanDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() > days * 24 * 60 * 60 * 1000;

const isReceived = (status: string) => ["paid", "shipped", "delivered"].includes(status);

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
      <div className={cn("h-full rounded-full bg-primary", className)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export default async function FinancialHealthPage() {
  await requireAdmin();
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
  const received = receivedOrders.reduce((s, o) => s + receivedSoFar(o), 0);
  const receivable = receivables.reduce((s, o) => s + amountDue(o), 0);
  const overdue = receivables.filter((o) => isOlderThanDays(o.created_at, OVERDUE_DAYS));
  const overdueTotal = overdue.reduce((s, o) => s + amountDue(o), 0);

  // ---- saídas / estoque ---------------------------------------------------
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const stockCost = pricing.reduce((s, r) => s + r.stockCost, 0);
  const stockUnits = pricing.reduce((s, r) => s + r.stockUnits, 0);
  const productsWithoutCost = pricing.filter((r) => r.stockUnits > 0 && r.cost == null).length;

  // ---- indicadores --------------------------------------------------------
  const cashResult = received - spent;
  const overall = received + receivable + stockCost - spent;
  const recoveredPct = spent > 0 ? (received / spent) * 100 : null;

  const verdict =
    spent === 0 && received === 0
      ? { tone: "neutral" as const, title: "Sem dados ainda", text: "Lance gastos e registre vendas para ver a saúde da loja." }
      : cashResult >= 0
        ? { tone: "good" as const, title: "No azul no caixa", text: "Tudo que já entrou cobre tudo que já saiu." }
        : overall >= 0
          ? {
              tone: "warn" as const,
              title: "Recuperando o investimento",
              text: "O caixa ainda está negativo, mas o estoque e o que está a receber cobrem a diferença.",
            }
          : {
              tone: "bad" as const,
              title: "Investimento ainda não recuperado",
              text: `Mesmo contando estoque e valores a receber, faltam ${formatBRL(Math.abs(overall))} para empatar.`,
            };

  // ---- por mês (últimos N) ------------------------------------------------
  const current = currentMonthBr();
  const firstActivity = [...expenses.map((e) => e.spent_on.slice(0, 7)), ...receivedOrders.map((o) => monthKeyBr(o.created_at))]
    .sort()[0];
  // últimos N meses, sem mostrar os vazios de antes da loja começar a movimentar
  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => shiftMonth(current, i - (MONTHS_SHOWN - 1))).filter(
    (ym) => !firstActivity || ym >= firstActivity,
  );
  const monthly = months.map((ym) => {
    const out = expenses.filter((e) => e.spent_on.slice(0, 7) === ym).reduce((s, e) => s + e.amount, 0);
    const inn = receivedOrders
      .filter((o) => monthKeyBr(o.created_at) === ym)
      .reduce((s, o) => s + receivedSoFar(o), 0);
    return { ym, out, inn, result: inn - out };
  });
  const monthlyMax = Math.max(1, ...monthly.flatMap((m) => [m.out, m.inn]));
  const activeMonths = new Set([
    ...expenses.map((e) => e.spent_on.slice(0, 7)),
    ...receivedOrders.map((o) => monthKeyBr(o.created_at)),
  ]).size;
  const avgSpent = activeMonths > 0 ? spent / activeMonths : 0;
  const avgReceived = activeMonths > 0 ? received / activeMonths : 0;

  // ---- quebras dos gastos -------------------------------------------------
  const sum = (pred: (e: (typeof expenses)[number]) => boolean) =>
    expenses.filter(pred).reduce((s, e) => s + e.amount, 0);
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
      `${overdue.length} venda${overdue.length === 1 ? "" : "s"} a receber há mais de ${OVERDUE_DAYS} dias (${formatBRL(overdueTotal)}).`,
    );
  if (noPayer > 0) alerts.push(`${formatBRL(noPayer)} em gastos sem "quem pagou" — ficam fora da comparação entre os sócios.`);
  if (productsWithoutCost > 0)
    alerts.push(
      `${productsWithoutCost} produto${productsWithoutCost === 1 ? "" : "s"} em estoque sem custo cadastrado — o valor do estoque está subestimado.`,
    );

  const Tone = verdict.tone === "good" ? CheckCircle2 : verdict.tone === "neutral" ? TrendingUp : AlertTriangle;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">Saúde financeira</h1>
        <p className="mt-1 text-sm text-muted">
          Visão geral de tudo que já entrou e saiu da loja desde o começo.{" "}
          <Link href="/admin/gastos" className="font-semibold text-primary hover:underline">
            Lançar gastos
          </Link>
        </p>
      </div>

      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-5",
          verdict.tone === "good" && "border-success/30 bg-success/10",
          verdict.tone === "warn" && "border-warning/30 bg-warning/10",
          verdict.tone === "bad" && "border-danger/30 bg-danger/10",
          verdict.tone === "neutral" && "border-border bg-surface",
        )}
      >
        <Tone
          className={cn(
            "mt-0.5 h-6 w-6 shrink-0",
            verdict.tone === "good" && "text-success",
            verdict.tone === "warn" && "text-warning",
            verdict.tone === "bad" && "text-danger",
            verdict.tone === "neutral" && "text-muted",
          )}
        />
        <div>
          <p className="text-lg font-black">{verdict.title}</p>
          <p className="text-sm">{verdict.text}</p>
          {recoveredPct != null && (
            <p className="mt-2 text-sm">
              Já voltou <strong>{Math.round(recoveredPct)}%</strong> do que foi gasto
              {spent > 0 && overall > cashResult ? (
                <>
                  {" "}
                  (<strong>{Math.round(((received + receivable + stockCost) / spent) * 100)}%</strong> contando estoque e a
                  receber)
                </>
              ) : null}
              .
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total gasto", value: spent, hint: "tudo que saiu" },
          { label: "Total recebido", value: received, hint: "vendas pagas, líquido da taxa" },
          {
            label: "Resultado do caixa",
            value: cashResult,
            hint: "recebido − gasto",
            tone: cashResult >= 0 ? "text-success" : "text-danger",
          },
          { label: "A receber", value: receivable, hint: "vendas na loja ainda não pagas" },
          { label: "Estoque a custo", value: stockCost, hint: `${stockUnits} peça${stockUnits === 1 ? "" : "s"} paradas` },
          {
            label: "Saldo geral",
            value: overall,
            hint: "caixa + a receber + estoque",
            tone: overall >= 0 ? "text-success" : "text-danger",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold text-muted">{c.label}</p>
            <p className={cn("mt-1 text-xl font-black sm:text-2xl", c.tone)}>{formatBRL(c.value)}</p>
            <p className="mt-0.5 text-xs text-muted">{c.hint}</p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-warning">
            <AlertTriangle className="h-4 w-4" /> Pontos de atenção
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="font-bold">Mês a mês</p>
          <p className="text-xs text-muted">
            Média por mês com movimento: gasta {formatBRL(avgSpent)} · recebe {formatBRL(avgReceived)}.
          </p>
        </div>
        <div className="space-y-4">
          {monthly.map((m) => (
            <div key={m.ym}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold first-letter:uppercase">{monthLabel(m.ym)}</span>
                <span className={cn("font-bold tabular-nums", m.result >= 0 ? "text-success" : "text-danger")}>
                  {formatBRL(m.result)}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-16 shrink-0">Recebido</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-success" style={{ width: `${(m.inn / monthlyMax) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right tabular-nums">{formatBRL(m.inn)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-16 shrink-0">Gasto</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-danger" style={{ width: `${(m.out / monthlyMax) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right tabular-nums">{formatBRL(m.out)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { title: "Gastos por categoria", items: byCategory },
          { title: "Gastos por tipo", items: byType },
        ].map((block) => (
          <div key={block.title} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <p className="font-bold">{block.title}</p>
            {block.items.length === 0 ? (
              <p className="text-sm text-muted">Nenhum gasto classificado ainda.</p>
            ) : (
              block.items.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="font-semibold tabular-nums">
                      {formatBRL(r.amount)}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {spent > 0 ? Math.round((r.amount / spent) * 100) : 0}%
                      </span>
                    </span>
                  </div>
                  <Bar pct={spent > 0 ? (r.amount / spent) * 100 : 0} />
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <p className="font-bold">Quem investiu</p>
        {byPayer.map(({ payer, amount }) => (
          <div key={payer}>
            <div className="flex justify-between text-sm">
              <span>{PAYER_LABELS[payer]}</span>
              <span className="font-semibold tabular-nums">
                {formatBRL(amount)}
                <span className="ml-2 text-xs font-normal text-muted">
                  {spent > 0 ? Math.round((amount / spent) * 100) : 0}%
                </span>
              </span>
            </div>
            <Bar pct={spent > 0 ? (amount / spent) * 100 : 0} className={payer === "miilo" ? "bg-muted" : undefined} />
          </div>
        ))}
        {noPayer > 0 && (
          <p className="text-xs text-muted">Sem informação de quem pagou: {formatBRL(noPayer)}.</p>
        )}
        <p className="border-t border-border pt-3 text-xs text-muted">
          {amtA === amtB
            ? "Os dois núcleos investiram o mesmo valor."
            : `${PAYER_LABELS[amtA > amtB ? invA : invB]} investiu ${formatBRL(Math.abs(amtA - amtB))} a mais que ${PAYER_LABELS[amtA > amtB ? invB : invA]}.`}
        </p>
      </div>

      <p className="text-xs text-muted">
        Como ler: &quot;Total recebido&quot; usa só vendas pagas (líquido da taxa do Mercado Pago). &quot;Saldo geral&quot;
        soma o que já entrou, o que está a receber e o estoque parado ao preço de custo, e subtrai tudo que foi gasto
        — é uma estimativa, não um balanço contábil. Estoque sem custo cadastrado conta como zero.
      </p>
    </div>
  );
}
