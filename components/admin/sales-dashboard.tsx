"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { OrderChannel, OrderStatus } from "@/lib/types";
import { ORDER_STATUS } from "@/lib/order-status";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";

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

function BarList({
  items,
  money,
  empty,
}: {
  items: { label: string; value: number; hint?: string }[];
  money?: boolean;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0)
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((i, idx) => (
        <div key={idx} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-medium" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 font-semibold">
              {money ? formatBRL(i.value) : i.value}
              {i.hint && (
                <span className="ml-1 text-[11px] font-normal text-muted">{i.hint}</span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
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
                "w-full rounded-t bg-primary/85 transition-colors group-hover:bg-primary",
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
}: {
  orders: DashOrder[];
  outOfStock: number;
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
    const statusBars = (Object.keys(ORDER_STATUS) as OrderStatus[])
      .map((s) => ({ label: ORDER_STATUS[s].label, value: statusCounts.get(s) ?? 0 }))
      .filter((b) => b.value > 0);

    // top produtos
    const prodMap = new Map<string, { units: number; revenue: number }>();
    for (const o of paid)
      for (const it of o.items) {
        const e = prodMap.get(it.name) ?? { units: 0, revenue: 0 };
        e.units += it.qty;
        e.revenue += it.total;
        prodMap.set(it.name, e);
      }
    const topProducts = [...prodMap.entries()]
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 6)
      .map(([name, e]) => ({
        label: name,
        value: e.units,
        hint: formatBRL(e.revenue),
      }));

    // meios de pagamento
    const payMap = new Map<string, number>();
    for (const o of paid) payMap.set(payLabel(o.paymentMethod), (payMap.get(payLabel(o.paymentMethod)) ?? 0) + 1);
    const payBars = [...payMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    // canal
    const online = paid.filter((o) => o.channel === "online").length;
    const pos = paid.filter((o) => o.channel === "pos").length;

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
      statusBars,
      topProducts,
      payBars,
      online,
      pos,
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-black">Mais vendidos</h2>
          <BarList items={view.topProducts} empty="Nenhuma venda no período." />
        </Card>
        <Card>
          <h2 className="mb-3 font-black">Pedidos por status</h2>
          <BarList items={view.statusBars} empty="Nenhum pedido no período." />
        </Card>
        <Card>
          <h2 className="mb-3 font-black">Meios de pagamento</h2>
          <BarList items={view.payBars} empty="Nenhuma venda paga." />
        </Card>
        <Card>
          <h2 className="mb-3 font-black">Canal de venda</h2>
          {view.online + view.pos === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhuma venda paga.</p>
          ) : (
            <BarList
              items={[
                { label: "Loja online", value: view.online },
                { label: "Venda na loja", value: view.pos },
              ].filter((b) => b.value > 0)}
              empty=""
            />
          )}
        </Card>
      </div>

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
