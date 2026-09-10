"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { OrderChannel, OrderStatus } from "@/lib/types";
import type { PricingInsights } from "@/lib/data/pricing";
import { ORDER_STATUS } from "@/lib/order-status";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { ProductPerformance } from "@/components/admin/product-performance";

export type DashOrder = {
  id: string;
  number: string;
  email: string;
  created_at: string;
  status: OrderStatus;
  total: number;
  channel: OrderChannel;
  paymentMethod: string | null;
  items: { name: string; qty: number; total: number }[];
};

const PAID: OrderStatus[] = ["paid", "shipped", "delivered"];
const isPaid = (o: DashOrder) => PAID.includes(o.status);

type RangeId = "7d" | "30d" | "90d" | "12m" | "all";
const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "12m", label: "12 meses", days: 365 },
  { id: "all", label: "Tudo", days: null },
];

type ChannelId = "all" | OrderChannel;

function payLabel(method: string | null): string {
  if (!method) return "Não informado";
  const m = method.toLowerCase();
  if (m.includes("pix")) return "Pix";
  if (m.includes("dinheiro") || m === "manual" || m.includes("cash")) return "Dinheiro / maquininha";
  if (m.includes("account")) return "Saldo Mercado Pago";
  return "Cartão";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const TONE_CLASS: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  primary: "bg-accent",
  neutral: "bg-muted",
};

const PAY_CLASS: Record<string, string> = {
  Pix: "bg-accent",
  Cartão: "bg-sky",
  "Dinheiro / maquininha": "bg-yellow",
  "Saldo Mercado Pago": "bg-pink",
  "Não informado": "bg-muted",
};

// -------------------------------------------------------------------------

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

function SegmentBar({
  title,
  segments,
  empty,
}: {
  title: string;
  segments: { label: string; value: number; className: string }[];
  empty: string;
}) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {shown.map((s, i) => (
              <div
                key={i}
                className={cn("h-full", s.className)}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {shown.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", s.className)} />
                <span className="font-medium">{s.label}</span>
                <span className="text-muted">
                  {s.value} · {Math.round((s.value / total) * 100)}%
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RevenueChart({
  buckets,
}: {
  buckets: { label: string; value: number; sub: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const total = buckets.reduce((s, b) => s + b.value, 0);
  if (total === 0)
    return (
      <p className="py-10 text-center text-sm text-muted">
        Sem vendas pagas nesse período.
      </p>
    );
  return (
    <div>
      <div className="relative flex h-44 items-end gap-1">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-dashed border-border/60" />
          ))}
        </div>
        {buckets.map((b, i) => (
          <button
            type="button"
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group flex h-full flex-1 flex-col justify-end"
          >
            <div
              className={cn(
                "w-full rounded-t bg-accent/85 transition-colors group-hover:bg-accent",
                b.value === 0 && "bg-black/[0.06]",
              )}
              style={{ height: `${b.value === 0 ? 2 : Math.max(4, (b.value / max) * 100)}%` }}
            />
          </button>
        ))}
        {hover != null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-lg bg-foreground px-2 py-1 text-xs font-semibold text-background shadow"
            style={{
              left: `${((hover + 0.5) / buckets.length) * 100}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            {formatBRL(buckets[hover].value)}
            <span className="block text-[10px] font-normal opacity-80">
              {buckets[hover].sub}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        {(() => {
          const n = buckets.length;
          const pick =
            n <= 8
              ? buckets.map((_, i) => i)
              : [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1];
          return [...new Set(pick)].map((i) => (
            <span key={i}>{buckets[i]?.label}</span>
          ));
        })()}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">{children}</div>
  );
}

// -------------------------------------------------------------------------

export function SalesDashboard({
  orders,
  outOfStock,
  performance,
}: {
  orders: DashOrder[];
  outOfStock: number;
  performance: PricingInsights;
}) {
  const [range, setRange] = useState<RangeId>("30d");
  const [channel, setChannel] = useState<ChannelId>("all");

  const view = useMemo(() => {
    const cfg = RANGES.find((r) => r.id === range)!;
    const now = new Date();
    const cutoff = cfg.days ? startOfDay(new Date(now.getTime() - (cfg.days - 1) * 86400000)) : null;
    const prevCutoff = cfg.days
      ? startOfDay(new Date(now.getTime() - (cfg.days * 2 - 1) * 86400000))
      : null;

    const byChannel = (o: DashOrder) => channel === "all" || o.channel === channel;

    const inRange = orders.filter((o) => {
      if (!byChannel(o)) return false;
      if (!cutoff) return true;
      return new Date(o.created_at) >= cutoff;
    });
    const prevRange =
      cutoff && prevCutoff
        ? orders.filter(
            (o) =>
              byChannel(o) &&
              new Date(o.created_at) >= prevCutoff &&
              new Date(o.created_at) < cutoff,
          )
        : [];

    const paid = inRange.filter(isPaid);
    const prevPaid = prevRange.filter(isPaid);

    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const units = paid.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    const prevRevenue = prevPaid.reduce((s, o) => s + o.total, 0);

    // buckets do gráfico de receita
    const bucketMode: "day" | "week" | "month" =
      !cfg.days || cfg.days > 120 ? "month" : cfg.days > 45 ? "week" : "day";
    const buckets: { label: string; value: number; sub: string }[] = [];
    if (bucketMode === "day") {
      const start = cutoff ?? startOfDay(new Date(now.getTime() - 29 * 86400000));
      for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        buckets.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          sub: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          value: 0,
        });
      }
      const idxOf = (dt: Date) =>
        Math.floor((startOfDay(dt).getTime() - start.getTime()) / 86400000);
      for (const o of paid) {
        const i = idxOf(new Date(o.created_at));
        if (i >= 0 && i < buckets.length) buckets[i].value += o.total;
      }
    } else if (bucketMode === "week") {
      const weeks = 13;
      const end = startOfDay(now);
      for (let w = weeks - 1; w >= 0; w--) {
        const ws = new Date(end.getTime() - w * 7 * 86400000);
        buckets.push({
          label: ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          sub: `semana de ${ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
          value: 0,
        });
      }
      const firstWeekStart = new Date(end.getTime() - (weeks - 1) * 7 * 86400000);
      for (const o of paid) {
        const i = Math.floor(
          (startOfDay(new Date(o.created_at)).getTime() - firstWeekStart.getTime()) /
            (7 * 86400000),
        );
        if (i >= 0 && i < buckets.length) buckets[i].value += o.total;
      }
    } else {
      const months = 12;
      const base = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let m = months - 1; m >= 0; m--) {
        const d = new Date(base.getFullYear(), base.getMonth() - m, 1);
        buckets.push({
          label: d.toLocaleDateString("pt-BR", { month: "short" }),
          sub: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          value: 0,
        });
      }
      for (const o of paid) {
        const dt = new Date(o.created_at);
        const i =
          (dt.getFullYear() - base.getFullYear()) * 12 +
          (dt.getMonth() - base.getMonth()) +
          (months - 1);
        if (i >= 0 && i < buckets.length) buckets[i].value += o.total;
      }
    }

    // status
    const statusCounts = new Map<OrderStatus, number>();
    for (const o of inRange)
      statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
    const statusSegs = (Object.keys(ORDER_STATUS) as OrderStatus[])
      .map((s) => ({
        label: ORDER_STATUS[s].label,
        value: statusCounts.get(s) ?? 0,
        className: TONE_CLASS[ORDER_STATUS[s].tone],
      }))
      .filter((b) => b.value > 0);

    // meios de pagamento
    const payMap = new Map<string, number>();
    for (const o of paid) payMap.set(payLabel(o.paymentMethod), (payMap.get(payLabel(o.paymentMethod)) ?? 0) + 1);
    const paySegs = [...payMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, className: PAY_CLASS[label] ?? "bg-muted" }));

    // canal
    const online = paid.filter((o) => o.channel === "online").length;
    const pos = paid.filter((o) => o.channel === "pos").length;
    const channelSegs = [
      { label: "Loja online", value: online, className: "bg-accent" },
      { label: "Venda na loja", value: pos, className: "bg-sky" },
    ];

    return {
      revenue,
      prevRevenue,
      paidCount: paid.length,
      prevPaidCount: prevPaid.length,
      units,
      prevUnits: prevPaid.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0),
      avg: paid.length ? revenue / paid.length : 0,
      prevAvg: prevPaid.length ? prevRevenue / prevPaid.length : 0,
      pending: inRange.filter((o) => o.status === "pending").length,
      buckets,
      statusSegs,
      paySegs,
      channelSegs,
      channelTotal: online + pos,
      hasCompare: !!cutoff,
      recent: [...inRange]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 6),
    };
  }, [orders, range, channel]);

  const kpis = [
    { label: "Receita paga", value: formatBRL(view.revenue), now: view.revenue, prev: view.prevRevenue, money: true },
    { label: "Pedidos pagos", value: String(view.paidCount), now: view.paidCount, prev: view.prevPaidCount },
    { label: "Ticket médio", value: formatBRL(view.avg), now: view.avg, prev: view.prevAvg, money: true },
    { label: "Itens vendidos", value: String(view.units), now: view.units, prev: view.prevUnits },
  ];

  const channels: { id: ChannelId; label: string }[] = [
    { id: "all", label: "Todos os canais" },
    { id: "online", label: "Loja online" },
    { id: "pos", label: "Venda na loja" },
  ];

  return (
    <div className="space-y-6">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                range === r.id
                  ? "bg-foreground text-background"
                  : "border border-border bg-surface",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as ChannelId)}
          className="ml-auto h-9 rounded-lg border border-border bg-surface px-2 text-sm"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {outOfStock > 0 && (
        <Link
          href="/admin/estoque?f=out"
          className="block rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/15"
        >
          {outOfStock} variaç{outOfStock > 1 ? "ões esgotadas" : "ão esgotada"} — repor →
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {k.label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-xl font-black">{k.value}</p>
              {view.hasCompare && <Delta now={k.now} prev={k.prev} money={k.money} />}
            </div>
          </Card>
        ))}
      </div>

      {/* receita ao longo do tempo */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">Receita paga</h2>
          <span className="text-xs text-muted">{formatBRL(view.revenue)} no período</span>
        </div>
        <RevenueChart buckets={view.buckets} />
      </Card>

      <ProductPerformance x={performance} />

      <Card>
        <h2 className="mb-4 font-black">Como as vendas se dividem</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SegmentBar
            title="Pedidos por status"
            segments={view.statusSegs}
            empty="Nenhum pedido no período."
          />
          <SegmentBar
            title="Meios de pagamento"
            segments={view.paySegs}
            empty="Nenhuma venda paga."
          />
          <SegmentBar
            title="Canal de venda"
            segments={view.channelSegs}
            empty="Nenhuma venda paga."
          />
        </div>
      </Card>

      {/* pedidos recentes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-primary">
            ver todos
          </Link>
        </div>
        {view.recent.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido no período.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {view.recent.map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos/${o.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/[0.02]"
              >
                <span className="font-semibold">{o.number}</span>
                <span className="hidden min-w-0 flex-1 truncate text-muted sm:block">
                  {o.email}
                </span>
                <Badge tone={ORDER_STATUS[o.status].tone}>
                  {ORDER_STATUS[o.status].label}
                </Badge>
                <span className="ml-auto font-bold sm:ml-0">{formatBRL(o.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
