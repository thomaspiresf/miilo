"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Radio } from "lucide-react";
import type { GaOverview } from "@/lib/data/ga";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PeriodPicker, type PeriodRange } from "@/components/admin/period-picker";
import { loadGaOverviewAction } from "@/app/admin/analytics/actions";

function Delta({ now, prev, money }: { now: number; prev: number; money?: boolean }) {
  if (prev === 0) {
    if (now === 0) return null;
    return <span className="text-[11px] font-semibold text-success">novo</span>;
  }
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <span className="text-[11px] text-muted">estável</span>;
  const up = pct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold",
        up ? "text-success" : "text-danger",
      )}
      title={`Período anterior: ${money ? formatBRL(prev) : prev}`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  now,
  prev,
  hasCompare,
  money,
}: {
  label: string;
  value: string;
  now: number;
  prev: number;
  hasCompare: boolean;
  money?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <p className="text-lg font-black sm:text-xl">{value}</p>
        {hasCompare && <Delta now={now} prev={prev} money={money} />}
      </div>
    </div>
  );
}

export function GaDashboard({ initial }: { initial: GaOverview }) {
  const [data, setData] = useState<GaOverview>(initial);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPeriod(range: PeriodRange) {
    setErr(null);
    setPending(true);
    const res = await loadGaOverviewAction(range);
    setPending(false);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    setData(res);
  }

  const firstStep = data.funnel[0]?.count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {data.realtimeUsers != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
              <Radio className="h-3 w-3 animate-pulse" />
              {data.realtimeUsers} agora no site
            </span>
          )}
        </div>
        <PeriodPicker onChange={onPeriod} pending={pending} error={err} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          label="Usuários"
          value={data.users.toLocaleString("pt-BR")}
          now={data.users}
          prev={data.prevUsers}
          hasCompare={data.hasCompare}
        />
        <Kpi
          label="Sessões"
          value={data.sessions.toLocaleString("pt-BR")}
          now={data.sessions}
          prev={data.prevSessions}
          hasCompare={data.hasCompare}
        />
        <Kpi
          label="Páginas vistas"
          value={data.pageViews.toLocaleString("pt-BR")}
          now={data.pageViews}
          prev={data.prevPageViews}
          hasCompare={data.hasCompare}
        />
        <Kpi
          label="Engajamento"
          value={`${Math.round(data.engagementRate * 100)}%`}
          now={data.engagementRate}
          prev={data.prevEngagementRate}
          hasCompare={data.hasCompare}
        />
        <Kpi
          label="Receita (GA)"
          value={formatBRL(data.revenue)}
          now={data.revenue}
          prev={data.prevRevenue}
          hasCompare={data.hasCompare}
          money
        />
        <Kpi
          label="Compras"
          value={data.transactions.toLocaleString("pt-BR")}
          now={data.transactions}
          prev={data.prevTransactions}
          hasCompare={data.hasCompare}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-black">Funil de vendas</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">
          Do primeiro clique num produto até a compra confirmada.
        </p>
        <ul className="space-y-3">
          {data.funnel.map((step, i) => {
            const pctOfFirst = firstStep > 0 ? (step.count / firstStep) * 100 : 0;
            const prevCount = i > 0 ? data.funnel[i - 1].count : null;
            const pctOfPrev =
              prevCount && prevCount > 0 ? (step.count / prevCount) * 100 : null;
            return (
              <li key={step.key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{step.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-black">{step.count.toLocaleString("pt-BR")}</span>
                    {pctOfPrev != null && (
                      <span className="text-xs text-muted">
                        {Math.round(pctOfPrev)}% do passo anterior
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(pctOfFirst, step.count > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-black">De onde vêm as visitas</h2>
        {data.acquisition.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem dados no período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.acquisition.map((c) => (
              <li key={c.channel} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{c.channel}</span>
                <span className="text-muted">
                  {c.sessions.toLocaleString("pt-BR")} sessões ·{" "}
                  {c.users.toLocaleString("pt-BR")} usuários
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
