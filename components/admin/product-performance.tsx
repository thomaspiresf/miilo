"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { InsightProduct, PricingInsights } from "@/lib/data/pricing";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { loadProductPerformanceAction } from "@/app/admin/actions";
import { PeriodPicker } from "@/components/admin/period-picker";

type InsightSort = "contrib" | "revenue" | "unitsSold" | "stockUnits" | "total";

const INSIGHT_SORTS: { key: InsightSort; label: string; money?: boolean }[] = [
  { key: "contrib", label: "Contribuição", money: true },
  { key: "revenue", label: "Receita", money: true },
  { key: "unitsSold", label: "Vendidas" },
  { key: "stockUnits", label: "Em estoque" },
  { key: "total", label: "Entraram" },
];

const INSIGHT_CAPTION: { key: InsightSort; text: (p: InsightProduct) => string }[] =
  [
    { key: "total", text: (p) => `${p.total} entraram` },
    { key: "unitsSold", text: (p) => `${p.unitsSold} vendidas` },
    { key: "stockUnits", text: (p) => `${p.stockUnits} em estoque` },
    { key: "revenue", text: (p) => `${formatBRL(p.revenue)} receita` },
    { key: "contrib", text: (p) => `${formatBRL(p.contrib)} contribuição` },
  ];

const FIRST_SHOWN = 5;
const PAGE_SIZE = 25;

export function ProductPerformance({ x }: { x: PricingInsights }) {
  const [data, setData] = useState(x);
  const [sort, setSort] = useState<InsightSort>("contrib");
  const [limit, setLimit] = useState(FIRST_SHOWN);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [label, setLabel] = useState("Últimos 30 dias");
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...data.products].sort((a, b) => b[sort] - a[sort]),
    [data.products, sort],
  );
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sorted.filter((p) => p.name.toLowerCase().includes(q))
    : sorted;
  const max = Math.max(1, ...sorted.map((p) => Math.abs(p[sort])));
  const shown = filtered.slice(0, limit);
  const hero = INSIGHT_SORTS.find((s) => s.key === sort)!;

  async function handlePeriod(
    range: { days?: 7 | 15 | 30 | 90; from?: string; to?: string },
    labels: { long: string },
  ) {
    setErr(null);
    setPending(true);
    const res = await loadProductPerformanceAction(range);
    setPending(false);
    if (res && "error" in res) {
      setErr(res.error);
      return;
    }
    setData(res);
    setLimit(FIRST_SHOWN);
    setLabel(labels.long);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-black">Desempenho por produto</h2>
          <p className="mt-1 text-xs text-muted">
            <strong>{label}</strong> · estoque de agora.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(FIRST_SHOWN);
              }}
              placeholder="Buscar produto"
              className="h-9 w-36 rounded-lg border border-border bg-background pl-7 pr-6 text-xs sm:w-48"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <PeriodPicker onChange={handlePeriod} pending={pending} error={err} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-lg font-black leading-none text-success">
            {formatBRL(data.stockContribPotential)}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-muted">
            Contribuição parada no estoque
          </p>
        </div>
        <div>
          <p className="text-lg font-black leading-none">
            {formatBRL(data.stockRetail)}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-muted">
            Receita parada no estoque
          </p>
        </div>
        <div>
          <p className="text-lg font-black leading-none">{data.stockUnits}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted">
            Peças em estoque · {formatBRL(data.stockCost)} a custo
          </p>
        </div>
      </div>

      {data.noCostStock > 0 && (
        <p className="mt-2 text-xs text-warning">
          {data.noCostStock} produto(s) em estoque sem custo cadastrado — a
          contribuição deles não conta.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-muted">Ordenar por</span>
        {INSIGHT_SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              sort === s.key
                ? "bg-foreground text-background"
                : "border border-border text-muted hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 py-6 text-center text-xs text-muted">
          {q
            ? `Nenhum produto encontrado para "${query.trim()}".`
            : "Nenhum produto com venda no período ou estoque agora."}
        </p>
      ) : (
        <>
          <ol className={cn("mt-3", pending && "opacity-50")}>
            {shown.map((p, i) => {
              const idle = p.unitsSold === 0 && p.stockUnits > 0;
              const heroVal = p[sort];
              const heroText = hero.money ? formatBRL(heroVal) : String(heroVal);
              const caption = INSIGHT_CAPTION.filter((c) => c.key !== sort)
                .map((c) => c.text(p))
                .join(" · ");
              return (
                <li
                  key={p.name + i}
                  className="border-b border-border/50 py-2.5 last:border-0"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted">
                      {i + 1}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-semibold"
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-right text-base font-black tabular-nums",
                        sort === "contrib" && p.contrib > 0
                          ? "text-success"
                          : "text-foreground",
                      )}
                    >
                      {heroText}
                    </span>
                  </div>
                  <div className="ml-6 mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        sort === "contrib" ? "bg-success/70" : "bg-accent/70",
                      )}
                      style={{
                        width: `${Math.max(2, (Math.abs(heroVal) / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="ml-6 mt-1 text-[11px] text-muted">
                    {caption}
                    {!p.hasCost && (
                      <span className="text-warning"> · sem custo cadastrado</span>
                    )}
                    {idle && p.hasCost && <span> · parado</span>}
                  </p>
                </li>
              );
            })}
          </ol>
          {filtered.length > FIRST_SHOWN && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {limit < filtered.length && (
                <button
                  type="button"
                  onClick={() =>
                    setLimit((l) => (l < PAGE_SIZE ? PAGE_SIZE : l + PAGE_SIZE))
                  }
                  className="text-xs font-semibold text-primary"
                >
                  Mostrar mais ({filtered.length - limit} restantes)
                </button>
              )}
              {limit > FIRST_SHOWN && (
                <button
                  type="button"
                  onClick={() => setLimit(FIRST_SHOWN)}
                  className="text-xs font-semibold text-muted hover:text-foreground"
                >
                  Recolher
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
