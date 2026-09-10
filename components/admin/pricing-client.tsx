"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Box,
  Calculator,
  Check,
  ChevronDown,
  CreditCard,
  ImageOff,
  Package,
  Plus,
  Receipt,
  Search,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import type { PricingSettings } from "@/lib/types";
import type {
  BusinessHealth,
  InsightProduct,
  PricingInsights,
  PricingRow,
} from "@/lib/data/pricing";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/misc";
import { computeMargins, suggestForContribution } from "@/lib/pricing-math";
import {
  loadPricingInsightsAction,
  savePricingSettingsAction,
  setProductPricingAction,
} from "@/app/admin/precificacao/actions";

function toneChip(pct: number | null) {
  if (pct == null) return "bg-black/[0.06] text-muted";
  if (pct < 30) return "bg-danger/10 text-danger";
  if (pct < 45) return "bg-warning/15 text-warning";
  return "bg-success/10 text-success";
}
const brl = (n: number | null) => (n == null ? "—" : formatBRL(n));
const pctStr = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const num = (v: string) => {
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const fmt2 = (n: number) => n.toFixed(2).replace(".", ",");
const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

// =======================================================================

function HealthCard({ h }: { h: BusinessHealth }) {
  const cells = [
    { label: `Margem de contribuição (${h.periodDays}d)`, value: brl(h.contributionMargin) },
    { label: "Custo fixo / mês", value: brl(h.monthlyFixed) },
    {
      label: `Lucro real (${h.periodDays}d)`,
      value: brl(h.realProfit),
      tone: h.realProfit < 0 ? "text-danger" : "text-success",
    },
    {
      label: "Ponto de equilíbrio / mês",
      value: h.breakEven != null ? brl(h.breakEven) : "—",
    },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-black">Saúde do negócio</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label}>
            <p className={cn("text-lg font-black leading-none", c.tone)}>{c.value}</p>
            <p className="mt-1 text-[11px] text-muted">{c.label}</p>
          </div>
        ))}
      </div>
      {h.missingCost > 0 && (
        <p className="mt-3 text-xs text-warning">
          {brl(h.missingCost)} em vendas de produtos sem custo cadastrado — não
          entram no lucro. Cadastre o custo abaixo.
        </p>
      )}
      {h.avgMarginPct != null && (
        <p className="mt-1 text-xs text-muted">
          Margem média das vendas com custo: {h.avgMarginPct.toFixed(0)}%
        </p>
      )}
    </div>
  );
}

// =======================================================================
//  Estoque e vendas — ranking por produto
// =======================================================================

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

type InsightPeriod = "7" | "15" | "30" | "90" | "all" | "custom";

const PERIOD_CHIPS: { key: InsightPeriod; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "15", label: "15 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
];

const FIRST_SHOWN = 5;
const PAGE_SIZE = 25;

const brDate = (iso: string) =>
  iso.split("-").reverse().slice(0, 2).join("/");

function InsightsSection({ x }: { x: PricingInsights }) {
  const [data, setData] = useState(x);
  const [sort, setSort] = useState<InsightSort>("contrib");
  const [limit, setLimit] = useState(FIRST_SHOWN);
  const [period, setPeriod] = useState<InsightPeriod>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...data.products].sort((a, b) => b[sort] - a[sort]),
    [data.products, sort],
  );
  const max = Math.max(1, ...sorted.map((p) => Math.abs(p[sort])));
  const shown = sorted.slice(0, limit);
  const hero = INSIGHT_SORTS.find((s) => s.key === sort)!;

  async function apply(
    next: InsightPeriod,
    range: { days?: 7 | 15 | 30 | 90; from?: string; to?: string },
  ) {
    setPeriod(next);
    setErr(null);
    setPending(true);
    const res = await loadPricingInsightsAction(range);
    setPending(false);
    if (res && "error" in res) {
      setErr(res.error);
      return;
    }
    setData(res);
    setLimit(FIRST_SHOWN);
  }

  function pickPeriod(key: InsightPeriod) {
    if (key === "custom") {
      setPeriod("custom");
      if (!from || !to) {
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const past = new Date();
        past.setDate(past.getDate() - 30);
        setFrom(iso(past));
        setTo(iso(new Date()));
      }
      return;
    }
    if (key === "all") {
      apply("all", {});
      return;
    }
    apply(key, { days: Number(key) as 7 | 15 | 30 | 90 });
  }

  const periodLabel =
    period === "all"
      ? "desde o começo"
      : period === "custom"
        ? from && to
          ? `${brDate(from)} a ${brDate(to)}`
          : "período personalizado"
        : `últimos ${period} dias`;

  const kpis = [
    {
      value: formatBRL(data.stockContribPotential),
      label: "Contribuição parada no estoque",
      tone: "text-success",
    },
    { value: formatBRL(data.stockRetail), label: "Receita parada no estoque" },
    {
      value: `${data.stockUnits}`,
      label: `Peças em estoque · ${formatBRL(data.stockCost)} a custo`,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-1 font-black">Estoque e vendas</h2>
      <p className="mb-3 text-xs text-muted">
        Ranking dos produtos: vendas de <strong>{periodLabel}</strong>, estoque de
        agora. Escolha por qual número ordenar.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label}>
            <p className={cn("text-lg font-black leading-none", k.tone)}>
              {k.value}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      {data.noCostStock > 0 && (
        <p className="mt-2 text-xs text-warning">
          {data.noCostStock} produto(s) em estoque sem custo cadastrado — a
          contribuição deles não conta.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-muted">Período</span>
        {PERIOD_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => pickPeriod(c.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              period === c.key
                ? "bg-foreground text-background"
                : "border border-border text-muted hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
        {pending && <Spinner className="h-3.5 w-3.5" />}
      </div>

      {period === "custom" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted">até</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={!from || !to || pending}
            onClick={() => apply("custom", { from, to })}
            className="rounded-lg bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-danger">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
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

      {sorted.length === 0 ? (
        <p className="mt-4 py-6 text-center text-xs text-muted">
          Nenhum produto com venda no período ou estoque agora.
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
          {sorted.length > FIRST_SHOWN && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {limit < sorted.length && (
                <button
                  type="button"
                  onClick={() =>
                    setLimit((l) => (l < PAGE_SIZE ? PAGE_SIZE : l + PAGE_SIZE))
                  }
                  className="text-xs font-semibold text-primary"
                >
                  Mostrar mais ({sorted.length - limit} restantes)
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

// =======================================================================

/** input numérico que aceita vírgula enquanto digita (guarda o texto cru localmente). */
function LooseNum({
  value,
  onNumber,
  prefix,
  suffix,
  integer,
  className,
  placeholder = "",
}: {
  value: number;
  onNumber: (n: number) => void;
  prefix?: string;
  suffix?: string;
  integer?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [t, setT] = useState(() => (value ? String(value).replace(".", ",") : ""));
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border bg-background",
        className,
      )}
    >
      {prefix && <span className="pl-2 text-xs text-muted">{prefix}</span>}
      <input
        value={t}
        onChange={(e) => {
          const raw = e.target.value;
          setT(raw);
          const n = Number(raw.replace(",", "."));
          if (Number.isFinite(n) && n >= 0) onNumber(integer ? Math.round(n) : n);
          else if (raw.trim() === "") onNumber(0);
        }}
        inputMode={integer ? "numeric" : "decimal"}
        placeholder={placeholder}
        className="h-9 w-full bg-transparent px-2 text-sm outline-none"
      />
      {suffix && <span className="px-2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  integer,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix: string;
  integer?: boolean;
  hint?: string;
}) {
  return (
    <label className="text-xs">
      <span className="text-muted">{label}</span>
      <div className="mt-1">
        <LooseNum value={value} onNumber={onChange} suffix={suffix} integer={integer} />
      </div>
      {hint && <span className="mt-0.5 block text-[10px] text-muted">{hint}</span>}
    </label>
  );
}

function SettingsPanel({ initial }: { initial: PricingSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setNum(key: keyof PricingSettings, n: number) {
    setS((p) => ({ ...p, [key]: n }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await savePricingSettingsAction({
      ...s,
      fixedCosts: s.fixedCosts.filter((f) => f.label.trim()),
    });
    setSaving(false);
    if ("error" in res) setError(res.error);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh(); // recalcula a tabela com as regras novas
    }
  }

  const totalFixed = s.fixedCosts.reduce((a, f) => a + (f.amount || 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 font-black">Regras de precificação</span>
        {!open && (
          <span className="truncate text-[11px] text-muted">
            imposto {s.taxPercent}% · margem-alvo {s.targetMarginPercent}% · embalagem{" "}
            {formatBRL(s.packagingCost)}
          </span>
        )}
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs font-bold text-muted">Custos variáveis (entram na contribuição)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumField label="Imposto sobre a venda" value={s.taxPercent} onChange={(n) => setNum("taxPercent", n)} suffix="%" />
            <NumField label="Embalagem por pedido" value={s.packagingCost} onChange={(n) => setNum("packagingCost", n)} suffix="R$" />
            <NumField label="Margem-alvo (contribuição)" value={s.targetMarginPercent} onChange={(n) => setNum("targetMarginPercent", n)} suffix="%" hint="usada no preço sugerido" />
            <NumField label="Taxa MP — crédito" value={s.mpCreditPercent} onChange={(n) => setNum("mpCreditPercent", n)} suffix="%" hint="usada na conta (pior caso)" />
            <NumField label="Taxa MP — Pix" value={s.mpPixPercent} onChange={(n) => setNum("mpPixPercent", n)} suffix="%" />
            <NumField label="Taxa MP — débito" value={s.mpDebitPercent} onChange={(n) => setNum("mpDebitPercent", n)} suffix="%" />
          </div>

          <div>
            <p className="text-xs font-bold text-muted">
              Custos fixos mensais {totalFixed > 0 && `· ${formatBRL(totalFixed)}/mês`}
            </p>
            <p className="mb-2 mt-1 text-[11px] text-muted">
              Aluguel, funcionário, plataformas… Usados no “lucro real” do negócio, no
              card lá em cima.
            </p>
            <div className="space-y-2">
              {s.fixedCosts.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={f.label}
                    onChange={(e) => {
                      const next = [...s.fixedCosts];
                      next[i] = { ...f, label: e.target.value };
                      setS((p) => ({ ...p, fixedCosts: next }));
                    }}
                    placeholder="Ex.: aluguel, funcionário, plataformas"
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none"
                  />
                  <LooseNum
                    className="w-28"
                    prefix="R$"
                    value={f.amount}
                    onNumber={(n) => {
                      const next = [...s.fixedCosts];
                      next[i] = { ...f, amount: n };
                      setS((p) => ({ ...p, fixedCosts: next }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setS((p) => ({ ...p, fixedCosts: p.fixedCosts.filter((_, j) => j !== i) }))
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setS((p) => ({ ...p, fixedCosts: [...p.fixedCosts, { label: "", amount: 0 }] }))
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> adicionar custo fixo
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : saved ? <Check className="h-4 w-4" /> : "Salvar regras"}
          </Button>
        </div>
      )}
    </div>
  );
}

// =======================================================================
//  Detalhamento — pra onde vai o dinheiro da venda
// =======================================================================

const signed = (n: number) => (n < 0 ? `− ${formatBRL(-n)}` : formatBRL(n));

function BreakLine({
  icon,
  label,
  value,
  strong,
  sub,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  strong?: boolean;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className={cn("flex items-center gap-2", strong ? "font-bold" : "text-foreground")}>
        <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </span>
      <span className="shrink-0 text-right">
        <span className={cn(strong ? "text-base font-black" : "font-semibold", valueClass)}>
          {value == null ? "—" : signed(value)}
        </span>
        {sub && <span className="block text-[11px] text-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** Cascata da venda: quanto sobra depois de cada custo (estilo extrato). */
function PriceBreakdown({
  cost,
  price,
  settings,
}: {
  cost: number;
  price: number;
  settings: PricingSettings;
}) {
  const m = computeMargins(cost, price, settings);
  const hr = <div className="mx-3 border-t border-border/70" />;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-success" />
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Venda do produto</p>
          <p className="text-2xl font-black text-success">{formatBRL(price)}</p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-black/[0.03] text-sm">
        <BreakLine icon={<Package />} label="Custo do produto" value={-cost} />
        {hr}
        {m.packaging > 0 && (
          <BreakLine icon={<Box />} label="Embalagem" value={-m.packaging} />
        )}
        <BreakLine
          icon={<CreditCard />}
          label={`Taxa do cartão (${m.feePct}%)`}
          value={m.feeValue == null ? null : -m.feeValue}
        />
        <BreakLine
          icon={<Receipt />}
          label={`Imposto (${m.taxPct}%)`}
          value={m.taxValue == null ? null : -m.taxValue}
        />
        {hr}
        <BreakLine
          icon={<Wallet className="text-success" />}
          label="Sobra por venda"
          value={m.contribValue}
          strong
          valueClass={cn(m.contribValue != null && m.contribValue < 0 ? "text-danger" : "text-success")}
          sub={m.contribPct != null ? `${fmt1(m.contribPct)}% da venda` : undefined}
        />
      </div>
    </div>
  );
}

function verdict(contribPct: number | null, target: number) {
  const cp = contribPct ?? 0;
  if (cp <= 0) return { c: "text-danger", i: "🔴", t: "Prejuízo — você paga pra vender." };
  if (cp < target)
    return { c: "text-warning", i: "⚠️", t: `Contribuição abaixo da meta de ${target}%.` };
  return { c: "text-success", i: "✅", t: "Contribuição dentro da meta." };
}

function NumInput({
  value,
  onChange,
  onBlur,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suffix: string;
}) {
  return (
    <span className="inline-flex items-center rounded-lg border border-border bg-background px-2 transition focus-within:border-foreground/40">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode="decimal"
        className="h-8 w-12 bg-transparent text-right text-sm font-bold tabular-nums outline-none"
      />
      <span className="pl-1 text-xs text-muted">{suffix}</span>
    </span>
  );
}

function MarginSlider({
  value,
  onChange,
  min = 5,
  max = 80,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const clamped = Math.min(max, Math.max(min, value));
  const pct = ((clamped - min) / (max - min)) * 100;
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Margem de contribuição"
        className={cn(
          "h-2.5 w-full cursor-pointer appearance-none rounded-full outline-none",
          "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
          "[&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-md",
          "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground",
        )}
        style={{
          background: `linear-gradient(to right, var(--foreground) ${pct}%, rgba(0,0,0,0.10) ${pct}%)`,
        }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

export function PriceSimulator({ settings }: { settings: PricingSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  // custos das regras — editáveis só pra simular
  const [tax, setTax] = useState(settings.taxPercent);
  const [fee, setFee] = useState(settings.mpCreditPercent);
  const [pk, setPk] = useState(settings.packagingCost);

  // critério do preço: o último campo mexido é quem manda
  const [mode, setMode] = useState<"margin" | "price" | "markup">("margin");
  const [marginTarget, setMarginTarget] = useState(settings.targetMarginPercent);
  const [priceInput, setPriceInput] = useState("");
  const [markupTarget, setMarkupTarget] = useState(2.5);
  const [edit, setEdit] = useState<{ f: "margin" | "price" | "markup"; raw: string } | null>(
    null,
  );

  function onOpenChange(v: boolean) {
    if (v) {
      setTax(settings.taxPercent);
      setFee(settings.mpCreditPercent);
      setPk(settings.packagingCost);
      setMode("margin");
      setMarginTarget(settings.targetMarginPercent);
      setPriceInput("");
      setMarkupTarget(2.5);
      setEdit(null);
      setCost("");
    }
    setOpen(v);
  }

  const simSettings: PricingSettings = {
    ...settings,
    taxPercent: tax,
    mpCreditPercent: fee,
    packagingCost: pk,
  };
  const costN = num(cost);

  // preço de trabalho conforme o critério escolhido
  let priceN: number | null = null;
  if (costN != null) {
    if (mode === "margin") priceN = suggestForContribution(costN, simSettings, marginTarget);
    else if (mode === "markup")
      priceN = markupTarget > 0 ? Math.round(costN * markupTarget * 100) / 100 : null;
    else priceN = num(priceInput);
  }
  const m =
    costN != null && priceN != null && priceN > 0
      ? computeMargins(costN, priceN, simSettings)
      : null;

  const marginNow = m?.contribPct ?? marginTarget;
  const markupNow = m?.markup ?? markupTarget;

  const marginField =
    edit?.f === "margin"
      ? edit.raw
      : mode === "margin"
        ? String(marginTarget)
        : String(Math.round(marginNow));
  const markupField =
    edit?.f === "markup"
      ? edit.raw
      : mode === "markup"
        ? fmt1(markupTarget)
        : fmt1(markupNow);
  const priceFieldVal =
    edit?.f === "price"
      ? edit.raw
      : mode === "price"
        ? priceInput
        : priceN != null
          ? fmt2(priceN)
          : "";

  function driveMargin(raw: string) {
    setEdit({ f: "margin", raw });
    const n = num(raw);
    if (n != null) {
      setMode("margin");
      setMarginTarget(Math.min(89, n));
    }
  }
  function driveMarkup(raw: string) {
    setEdit({ f: "markup", raw });
    const n = num(raw);
    if (n != null && n > 0) {
      setMode("markup");
      setMarkupTarget(n);
    }
  }
  function drivePrice(raw: string) {
    setEdit({ f: "price", raw });
    setMode("price");
    setPriceInput(raw);
  }
  function sliderMargin(n: number) {
    setEdit(null);
    setMode("margin");
    setMarginTarget(n);
  }
  const stopEdit = () => setEdit(null);

  const eq = (a: number, b: number) => Math.abs(a - b) < 0.001;
  const rulesChanged =
    !eq(tax, settings.taxPercent) ||
    !eq(fee, settings.mpCreditPercent) ||
    !eq(pk, settings.packagingCost);
  const marginChanged =
    mode === "margin" && !eq(Math.round(marginTarget), settings.targetMarginPercent);
  const changed = rulesChanged || marginChanged;

  function restore() {
    setTax(settings.taxPercent);
    setFee(settings.mpCreditPercent);
    setPk(settings.packagingCost);
    setMode("margin");
    setMarginTarget(settings.targetMarginPercent);
    setPriceInput("");
    setEdit(null);
  }
  async function saveDefaults() {
    setSaving(true);
    await savePricingSettingsAction({
      ...settings,
      taxPercent: tax,
      mpCreditPercent: fee,
      packagingCost: pk,
      targetMarginPercent:
        mode === "margin" ? Math.round(marginTarget) : settings.targetMarginPercent,
    });
    setSaving(false);
    router.refresh();
  }

  const sliderValue = mode === "margin" ? marginTarget : Math.round(marginNow);
  const v = m ? verdict(m.contribPct, settings.targetMarginPercent) : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        <Calculator className="h-4 w-4" /> Simular preço de um produto
      </Button>

      <ModalContent
        title="Simular preço"
        description="Puxa as regras de precificação. Mude custo, preço, margem ou markup — tudo recalcula junto."
      >
        <div className="space-y-5">
          {/* custo */}
          <div>
            <p className="text-xs font-medium text-muted">Custo de compra (por unidade)</p>
            <div className="mt-1.5">
              <LotField value={cost} onChange={setCost} />
            </div>
          </div>

          {/* custos das regras */}
          <div className="rounded-xl border border-border bg-black/[0.02] p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted">Custos (das regras)</p>
              {changed && (
                <button
                  type="button"
                  onClick={restore}
                  className="text-[11px] font-medium text-muted hover:text-foreground"
                >
                  restaurar
                </button>
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Imposto" value={tax} onChange={setTax} suffix="%" />
              <NumField label="Taxa do cartão" value={fee} onChange={setFee} suffix="%" />
              <NumField label="Embalagem" value={pk} onChange={setPk} suffix="R$" />
            </div>
          </div>

          {/* resultado — critérios conectados */}
          {costN == null ? (
            <p className="text-sm text-muted">Digite o custo pra começar.</p>
          ) : m == null ? (
            <p className="text-sm text-muted">Digite um preço ou escolha uma margem.</p>
          ) : (
            <div className="space-y-4 border-t border-border pt-4">
              {/* preço */}
              <div>
                <p className="text-xs font-medium text-muted">Preço de venda</p>
                <div className="mt-1.5">
                  <MoneyInput value={priceFieldVal} onChange={drivePrice} onBlur={stopEdit} />
                </div>
                {v && (
                  <p className={cn("mt-1.5 text-sm font-semibold", v.c)}>
                    {v.i} {v.t}
                  </p>
                )}
              </div>

              {/* margem + barra */}
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium text-muted">Margem de contribuição</p>
                  <NumInput
                    value={marginField}
                    onChange={driveMargin}
                    onBlur={stopEdit}
                    suffix="%"
                  />
                </div>
                <div className="mt-2">
                  <MarginSlider value={sliderValue} onChange={sliderMargin} />
                </div>
              </div>

              {/* markup */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted">Markup</p>
                  <p className="text-[11px] text-muted">preço ÷ custo</p>
                </div>
                <NumInput
                  value={markupField}
                  onChange={driveMarkup}
                  onBlur={stopEdit}
                  suffix="×"
                />
              </div>

              {changed && (
                <button
                  type="button"
                  onClick={saveDefaults}
                  disabled={saving}
                  className="text-xs font-semibold text-primary disabled:opacity-60"
                >
                  {saving ? "salvando…" : "salvar esses valores nas regras"}
                </button>
              )}

              <PriceBreakdown cost={costN} price={priceN ?? 0} settings={simSettings} />
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

// =======================================================================
//  Estado editável — custo, preço, margem % e markup interligados.
// =======================================================================

type RowCtx = {
  settings: PricingSettings;
  d: (r: PricingRow) => { cost: string; price: string };
  base: (r: PricingRow) => { cost: string; price: string };
  setD: (r: PricingRow, patch: Partial<{ cost: string; price: string }>) => void;
  save: (r: PricingRow) => void;
  saving: Record<string, boolean>;
  saved: Record<string, boolean>;
};

function usePriceRow(r: PricingRow, ctx: RowCtx) {
  const s = ctx.settings;
  const cur = ctx.d(r);
  const b = ctx.base(r);
  const multi = r.price == null;

  const [edit, setEdit] = useState<{ field: "contrib" | "markup"; raw: string } | null>(null);

  const costN = cur.cost === "" ? null : num(cur.cost);
  const priceN = num(cur.price) ?? r.priceMin;

  const m = computeMargins(costN, priceN, s);
  const suggested = costN != null ? suggestForContribution(costN, s, s.targetMarginPercent) : null;
  const canBump = !multi && suggested != null && suggested > priceN + 0.01;

  function setCost(v: string) {
    setEdit(null);
    ctx.setD(r, { cost: v });
  }
  function setPrice(v: string) {
    setEdit(null);
    ctx.setD(r, { price: v });
  }
  /** digitar a margem de contribuição → preço que a atinge */
  function driveContrib(v: string) {
    setEdit({ field: "contrib", raw: v });
    const mp = num(v);
    if (mp != null && costN != null) {
      const p = suggestForContribution(costN, s, mp);
      if (p != null) ctx.setD(r, { price: fmt2(p) });
    }
  }
  function driveMarkup(v: string) {
    setEdit({ field: "markup", raw: v });
    const mk = num(v);
    if (mk != null && mk > 0 && costN != null) {
      ctx.setD(r, { price: fmt2(Math.round(costN * mk * 100) / 100) });
    }
  }
  function applyTarget() {
    if (suggested != null) {
      setEdit(null);
      ctx.setD(r, { price: fmt2(suggested) });
    }
  }
  const stopEditing = () => setEdit(null);

  const contribField =
    edit?.field === "contrib"
      ? edit.raw
      : m.contribPct != null
        ? String(Math.round(m.contribPct))
        : "";
  const markupField =
    edit?.field === "markup" ? edit.raw : m.markup != null ? fmt1(m.markup) : "";

  const dirty = cur.cost !== b.cost || (!multi && cur.price !== b.price);
  const editable = !multi && costN != null;

  return {
    cur, multi, editable, costN, priceN, m, suggested, canBump, dirty,
    contribField, markupField,
    setCost, setPrice, driveContrib, driveMarkup, applyTarget, stopEditing,
  };
}

// ---- input que parece texto, só destaca no foco ---------------------

function Ghost({
  value,
  onChange,
  onBlur,
  prefix,
  suffix,
  ch,
  className,
  disabled,
  placeholder = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  prefix?: string;
  suffix?: string;
  ch: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <span
      className={cn(
        "-mx-1 inline-flex items-center gap-0.5 rounded-md px-1 transition",
        !disabled && "hover:bg-black/[0.04] focus-within:bg-black/[0.07]",
        className,
      )}
    >
      {prefix && <span className="text-muted">{prefix}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        inputMode="decimal"
        placeholder={placeholder}
        style={{ width: `${ch}ch` }}
        className="bg-transparent text-right tabular-nums outline-none disabled:cursor-default"
      />
      {suffix && <span className="text-muted">{suffix}</span>}
    </span>
  );
}

// ---- custo: valor OU "por lote" (total ÷ quantidade) -----------------

function CostField({
  value,
  onChange,
  big,
}: {
  value: string;
  onChange: (v: string) => void;
  big?: boolean;
}) {
  const [lot, setLot] = useState(false);
  const [total, setTotal] = useState("");
  const [qty, setQty] = useState("");
  const t = num(total);
  const q = Number(qty.replace(",", "."));
  const unit = t != null && q > 0 ? t / q : null;

  function apply(nt: string, nq: string) {
    const tt = num(nt);
    const qq = Number(nq.replace(",", "."));
    if (tt != null && qq > 0) onChange(fmt2(tt / qq));
  }

  if (lot) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-normal">
        <span className="inline-flex items-center gap-1">
          <span className="text-muted">R$</span>
          <input
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              apply(e.target.value, qty);
            }}
            inputMode="decimal"
            placeholder="total"
            autoFocus
            style={{ width: "5ch" }}
            className="rounded bg-black/[0.05] px-1 py-0.5 text-right tabular-nums outline-none"
          />
          <span className="text-muted">÷</span>
          <input
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              apply(total, e.target.value);
            }}
            inputMode="numeric"
            placeholder="qtd"
            style={{ width: "3ch" }}
            className="rounded bg-black/[0.05] px-1 py-0.5 text-center tabular-nums outline-none"
          />
        </span>
        <span className="font-semibold text-foreground">
          {unit != null ? `= R$ ${fmt2(unit)}` : "= —"}
        </span>
        <button type="button" onClick={() => setLot(false)} className="font-semibold text-primary">
          ok
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn(big ? "text-base font-bold" : "text-sm font-semibold")}>
        <Ghost value={value} onChange={onChange} prefix="R$" ch={big ? 5.5 : 5} />
      </span>
      <button
        type="button"
        onClick={() => setLot(true)}
        title="Calcular o custo unitário pelo valor total da compra"
        className="whitespace-nowrap text-[11px] font-semibold text-primary"
      >
        por lote
      </button>
    </span>
  );
}

// ---- células de margem/markup --------------------------------------

/** Margem bruta — só leitura (só o produto). */
function GrossCell({ p }: { p: ReturnType<typeof usePriceRow> }) {
  return (
    <span className="text-sm font-semibold tabular-nums">{pctStr(p.m.grossPct)}</span>
  );
}

/** Margem de contribuição — editável, colorida pelo nível, mexe no preço. */
function ContribCell({ p, showValue }: { p: ReturnType<typeof usePriceRow>; showValue?: boolean }) {
  if (p.m.contribPct == null) {
    return (
      <span className="rounded-md bg-black/[0.06] px-2 py-1 text-xs font-bold text-muted">
        sem custo
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-1 text-xs font-bold transition focus-within:ring-2 focus-within:ring-foreground/25",
          toneChip(p.m.contribPct),
        )}
      >
        <input
          value={p.contribField}
          onChange={(e) => p.driveContrib(e.target.value)}
          onBlur={p.stopEditing}
          disabled={!p.editable}
          inputMode="decimal"
          style={{ width: "2.3ch" }}
          className="bg-transparent text-right tabular-nums outline-none disabled:cursor-default"
        />
        %
      </span>
      {showValue && p.m.contribValue != null && (
        <span className="text-[11px] text-muted">{brl(p.m.contribValue)}</span>
      )}
    </span>
  );
}

/** Markup (preço ÷ custo) — editável, mexe no preço. */
function MarkupCell({ p }: { p: ReturnType<typeof usePriceRow> }) {
  if (p.m.markup == null) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center text-sm font-semibold text-foreground">
      <Ghost
        value={p.markupField}
        onChange={p.driveMarkup}
        onBlur={p.stopEditing}
        suffix="×"
        ch={2.6}
        disabled={!p.editable}
      />
    </span>
  );
}

function SaveBtn({ r, p, ctx, className }: { r: PricingRow; p: ReturnType<typeof usePriceRow>; ctx: RowCtx; className?: string }) {
  return (
    <Button
      size="sm"
      variant={p.dirty ? "primary" : "ghost"}
      disabled={!p.dirty || ctx.saving[r.productId]}
      onClick={() => ctx.save(r)}
      className={className}
    >
      {ctx.saving[r.productId] ? (
        <Spinner />
      ) : ctx.saved[r.productId] ? (
        <Check className="h-4 w-4" />
      ) : (
        "Salvar"
      )}
    </Button>
  );
}

function Thumb({ url, size }: { url: string | null; size: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md bg-black/5"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted">
          <ImageOff className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function SubLine({ r }: { r: PricingRow }) {
  return (
    <p className="truncate text-[11px] text-muted">
      {r.categoryName}
      {r.unitsSold > 0 && ` · vendeu ${r.unitsSold}`}
      {r.profitToDate != null && ` · contrib. ${brl(r.profitToDate)}`}
      {!r.active && " · inativo"}
    </p>
  );
}

/** legenda fixa — o que cada margem inclui */
function MarginLegend() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[11px] leading-relaxed text-muted">
      <span className="font-semibold text-foreground">Bruta</span> = só o produto ·{" "}
      <span className="font-semibold text-foreground">Contribuição</span> = produto +
      embalagem + taxa MP + imposto ·{" "}
      <span className="font-semibold text-foreground">Sobra por venda</span> = a contribuição
      em reais ·{" "}
      <span className="font-semibold text-foreground">Markup</span> = preço ÷ custo (não é
      margem)
    </div>
  );
}

function BumpLink({ p, ctx }: { p: ReturnType<typeof usePriceRow>; ctx: RowCtx }) {
  if (!p.canBump) return null;
  return (
    <button
      type="button"
      onClick={p.applyTarget}
      className="text-[11px] font-semibold text-warning hover:underline"
    >
      ↑ subir p/ {formatBRL(p.suggested!)} ({ctx.settings.targetMarginPercent}%)
    </button>
  );
}

// ---- visão em cartões ----------------------------------------------

function marginToneText(pct: number | null) {
  if (pct == null) return "text-muted";
  if (pct < 30) return "text-danger";
  if (pct < 45) return "text-warning";
  return "text-success";
}

/** input de dinheiro — bordado, prefixo R$, foco visível. */
function MoneyInput({
  value,
  onChange,
  onBlur,
  placeholder = "0,00",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 transition focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/[0.06]">
      <span className="text-sm text-muted">R$</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode="decimal"
        placeholder={placeholder}
        className="ml-1.5 w-full min-w-0 bg-transparent text-lg font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted/60"
      />
    </div>
  );
}

/** custo de compra — input + opção de calcular pelo total do lote. */
function LotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [lot, setLot] = useState(false);
  const [total, setTotal] = useState("");
  const [qty, setQty] = useState("");
  const t = num(total);
  const q = Number(qty.replace(",", "."));
  const unit = t != null && q > 0 ? t / q : null;

  function apply(nt: string, nq: string) {
    const tt = num(nt);
    const qq = Number(nq.replace(",", "."));
    if (tt != null && qq > 0) onChange(fmt2(tt / qq));
  }

  if (lot) {
    return (
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-[11px] font-medium text-muted">Total pago ÷ quantidade</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center rounded-lg border border-border px-2">
            <span className="text-xs text-muted">R$</span>
            <input
              value={total}
              onChange={(e) => {
                setTotal(e.target.value);
                apply(e.target.value, qty);
              }}
              inputMode="decimal"
              placeholder="404,00"
              autoFocus
              className="ml-1 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums outline-none"
            />
          </div>
          <span className="text-muted">÷</span>
          <input
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              apply(total, e.target.value);
            }}
            inputMode="numeric"
            placeholder="40"
            className="h-10 w-14 rounded-lg border border-border px-2 text-center text-sm font-semibold tabular-nums outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted">
            {unit != null ? (
              <>
                Custo unitário{" "}
                <span className="font-semibold text-foreground">R$ {fmt2(unit)}</span>
              </>
            ) : (
              "—"
            )}
          </span>
          <button
            type="button"
            onClick={() => setLot(false)}
            className="font-semibold text-foreground hover:underline"
          >
            aplicar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MoneyInput value={value} onChange={onChange} />
      <button
        type="button"
        onClick={() => setLot(true)}
        className="mt-1.5 text-[11px] font-medium text-muted hover:text-foreground"
      >
        calcular pelo total da compra
      </button>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium text-muted">{label}</p>
      <p className={cn("mt-1 text-sm font-bold tabular-nums", tone ?? "text-foreground")}>
        {value}
      </p>
      {sub && <p className="text-[11px] tabular-nums text-muted">{sub}</p>}
    </div>
  );
}

function CardRow({ r, ctx }: { r: PricingRow; ctx: RowCtx }) {
  const p = usePriceRow(r, ctx);
  const [details, setDetails] = useState(false);
  const showSave = p.dirty || ctx.saved[r.productId];

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      {/* identidade */}
      <div className="flex items-center gap-3">
        <Thumb url={r.imageUrl} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/produtos/${r.productId}`}
            className="line-clamp-1 text-[15px] font-semibold leading-tight hover:text-primary"
          >
            {r.name}
          </Link>
          <p className="truncate text-xs text-muted">
            {r.categoryName}
            {r.unitsSold > 0 &&
              ` · ${r.unitsSold} vendido${r.unitsSold > 1 ? "s" : ""}`}
            {!r.active && " · inativo"}
          </p>
        </div>
      </div>

      {p.multi ? (
        <p className="mt-4 text-xs text-muted">
          Preços variam por variação —{" "}
          <Link
            href={`/admin/produtos/${r.productId}`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            editar na tela do produto
          </Link>
        </p>
      ) : (
        <>
          {/* inputs */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted">Custo de compra</p>
              <div className="mt-1.5">
                <LotField value={p.cur.cost} onChange={p.setCost} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Preço de venda</p>
              <div className="mt-1.5">
                <MoneyInput value={p.cur.price} onChange={p.setPrice} />
              </div>
              {p.canBump && (
                <button
                  type="button"
                  onClick={p.applyTarget}
                  className="mt-1.5 text-[11px] font-medium text-warning hover:underline"
                >
                  sugerido {formatBRL(p.suggested!)} · {ctx.settings.targetMarginPercent}% de
                  contribuição
                </button>
              )}
            </div>
          </div>

          {/* métricas */}
          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-black/[0.025] px-4 py-3.5 sm:grid-cols-4">
            <Stat label="Margem bruta" value={pctStr(p.m.grossPct)} />
            <Stat
              label="Contribuição"
              value={pctStr(p.m.contribPct)}
              tone={marginToneText(p.m.contribPct)}
            />
            <Stat
              label="Sobra por venda"
              value={brl(p.m.contribValue)}
              tone={marginToneText(p.m.contribPct)}
            />
            <Stat
              label="Markup"
              value={p.m.markup == null ? "—" : `${fmt1(p.m.markup)}×`}
            />
          </div>

          {/* rodapé */}
          <div className="mt-4 flex items-center justify-between">
            {p.costN != null ? (
              <button
                type="button"
                onClick={() => setDetails((o) => !o)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
              >
                {details ? "Ocultar detalhamento" : "Ver detalhamento"}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition", details && "rotate-180")}
                />
              </button>
            ) : (
              <span />
            )}
            {showSave && <SaveBtn r={r} p={p} ctx={ctx} className="w-[88px]" />}
          </div>

          {details && p.costN != null && (
            <div className="mt-3">
              <PriceBreakdown cost={p.costN} price={p.priceN} settings={ctx.settings} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardsView({ rows, ctx }: { rows: PricingRow[]; ctx: RowCtx }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <CardRow key={r.productId} r={r} ctx={ctx} />
      ))}
    </div>
  );
}

// ---- visão em tabela ----------------------------------------------

type SortKey = "name" | "price" | "margin" | "sold";
type Sort = { key: SortKey | null; dir: "asc" | "desc" };

function SortTh({
  k,
  sort,
  onSort,
  children,
  className,
}: {
  k: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={cn("px-3 py-2.5 font-semibold", className)}>
      <button type="button" onClick={() => onSort(k)} className="hover:text-foreground">
        {children}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function TableRow({ r, ctx }: { r: PricingRow; ctx: RowCtx }) {
  const p = usePriceRow(r, ctx);
  const [details, setDetails] = useState(false);

  return (
    <>
      <tr className="border-b border-border/60 align-middle last:border-0">
        <td className="px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Thumb url={r.imageUrl} size={36} />
            <div className="w-[9.5rem] min-w-0 sm:w-52">
              <Link
                href={`/admin/produtos/${r.productId}`}
                className="line-clamp-1 font-semibold hover:text-primary"
              >
                {r.name}
              </Link>
              <SubLine r={r} />
            </div>
          </div>
        </td>

        <td className="px-3 py-3">
          <CostField value={p.cur.cost} onChange={p.setCost} />
        </td>

        <td className="whitespace-nowrap px-3 py-3">
          {p.multi ? (
            <span className="text-xs text-muted">
              {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
            </span>
          ) : (
            <span className="text-sm font-semibold">
              <Ghost value={p.cur.price} onChange={p.setPrice} prefix="R$" ch={5} />
            </span>
          )}
          {p.canBump && (
            <div className="mt-0.5">
              <BumpLink p={p} ctx={ctx} />
            </div>
          )}
        </td>

        <td className="whitespace-nowrap px-3 py-3">
          <GrossCell p={p} />
        </td>

        <td className="px-3 py-3">
          <ContribCell p={p} showValue />
        </td>

        <td className="whitespace-nowrap px-3 py-3">
          <MarkupCell p={p} />
          <div className="mt-0.5 text-[11px] text-muted">mín {brl(p.m.minPrice)}</div>
        </td>

        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <SaveBtn r={r} p={p} ctx={ctx} className="w-[68px]" />
            {p.costN != null && !p.multi && (
              <button
                type="button"
                onClick={() => setDetails((o) => !o)}
                title={details ? "Ocultar detalhamento" : "Ver detalhamento"}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-black/[0.04] hover:text-foreground"
              >
                <ChevronDown className={cn("h-4 w-4 transition", details && "rotate-180")} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {details && p.costN != null && !p.multi && (
        <tr className="border-b border-border/60">
          <td colSpan={7} className="bg-black/[0.02] px-3 py-3">
            <div className="max-w-md">
              <PriceBreakdown cost={p.costN} price={p.priceN} settings={ctx.settings} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TableView({
  rows,
  ctx,
  sort,
  onSort,
}: {
  rows: PricingRow[];
  ctx: RowCtx;
  sort: Sort;
  onSort: (k: SortKey) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            <SortTh k="name" sort={sort} onSort={onSort}>Produto</SortTh>
            <th className="px-3 py-2.5 font-semibold">Custo</th>
            <SortTh k="price" sort={sort} onSort={onSort}>Venda</SortTh>
            <th className="px-3 py-2.5 font-semibold">M. bruta</th>
            <SortTh k="margin" sort={sort} onSort={onSort}>M. contrib.</SortTh>
            <th className="px-3 py-2.5 font-semibold">Markup</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <TableRow key={r.productId} r={r} ctx={ctx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =======================================================================

type Filter = "all" | "nocost" | "low" | "promo";
type View = "cards" | "table";

export function PricingClient({
  rows,
  settings,
  health,
  insights,
}: {
  rows: PricingRow[];
  settings: PricingSettings;
  health: BusinessHealth;
  insights: PricingInsights;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("cards");
  const [sort, setSort] = useState<Sort>({ key: null, dir: "asc" });
  const [draft, setDraft] = useState<Record<string, { cost: string; price: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("miilo-pricing-view");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "table" || v === "cards") setView(v);
    } catch {}
  }, []);
  function pickView(v: View) {
    setView(v);
    try {
      localStorage.setItem("miilo-pricing-view", v);
    } catch {}
  }

  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        term &&
        !r.name.toLowerCase().includes(term) &&
        !r.categoryName.toLowerCase().includes(term)
      )
        return false;
      if (filter === "nocost") return r.cost == null;
      if (filter === "low") return (r.margins?.contribPct ?? 100) < 30;
      if (filter === "promo") return r.compareAt != null;
      return true;
    });
  }, [rows, term, filter]);

  const list = useMemo(() => {
    if (!sort.key) return filtered;
    const k = sort.key;
    const val = (r: PricingRow): number | string =>
      k === "name"
        ? r.name.toLowerCase()
        : k === "price"
          ? r.priceMin
          : k === "margin"
            ? r.margins?.contribPct ?? 9999
            : r.unitsSold;
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const c = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => {
      if (s.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "price" || key === "sold" ? "desc" : "asc" };
    });
  }

  const counts = {
    nocost: rows.filter((r) => r.cost == null).length,
    low: rows.filter((r) => (r.margins?.contribPct ?? 100) < 30).length,
  };

  function base(r: PricingRow) {
    return {
      cost: r.cost != null ? fmt2(r.cost) : "",
      price: r.price != null ? fmt2(r.price) : "",
    };
  }
  function d(r: PricingRow) {
    return draft[r.productId] ?? base(r);
  }
  function setD(r: PricingRow, patch: Partial<{ cost: string; price: string }>) {
    setDraft((s) => ({
      ...s,
      [r.productId]: { ...base(r), ...s[r.productId], ...patch },
    }));
    setSaved((s) => ({ ...s, [r.productId]: false }));
  }

  async function save(r: PricingRow) {
    const cur = d(r);
    const cost = cur.cost === "" ? null : num(cur.cost);
    const price = cur.price === "" ? undefined : num(cur.price);
    if (cur.cost !== "" && cost == null) return setError("Custo inválido");
    if (cur.price !== "" && price == null) return setError("Preço inválido");

    const payload: { productId: string; cost?: number | null; price?: number } = {
      productId: r.productId,
    };
    if (cost !== (r.cost ?? null)) payload.cost = cost;
    if (price != null && price !== r.price) payload.price = price;
    if (payload.cost === undefined && payload.price === undefined) return;

    setSaving((s) => ({ ...s, [r.productId]: true }));
    setError(null);
    const res = await setProductPricingAction(payload);
    setSaving((s) => ({ ...s, [r.productId]: false }));
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSaved((s) => ({ ...s, [r.productId]: true }));
    setDraft((s) => {
      const c = { ...s };
      delete c[r.productId];
      return c;
    });
    setTimeout(() => setSaved((s) => ({ ...s, [r.productId]: false })), 1500);
    router.refresh();
  }

  const ctx: RowCtx = { settings, d, base, setD, save, saving, saved };

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `Todos (${rows.length})` },
    { id: "nocost", label: `Sem custo (${counts.nocost})` },
    { id: "low", label: `Margem baixa (${counts.low})` },
    { id: "promo", label: "Em promoção" },
  ];

  return (
    <div className="space-y-4">
      <HealthCard h={health} />
      <InsightsSection x={insights} />
      <PriceSimulator settings={settings} />
      <SettingsPanel initial={settings} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-full border border-border bg-surface px-3 sm:max-w-xs">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produto"
              className="h-10 w-full bg-transparent px-2 text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  filter === t.id
                    ? "bg-foreground text-background"
                    : "border border-border bg-surface",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 rounded-full border border-border bg-surface p-0.5 text-xs font-semibold">
          {(["cards", "table"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => pickView(v)}
              className={cn(
                "rounded-full px-3 py-1.5",
                view === v ? "bg-foreground text-background" : "text-muted",
              )}
            >
              {v === "cards" ? "Cartões" : "Tabela"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <MarginLegend />

      {view === "table" ? (
        <TableView rows={list} ctx={ctx} sort={sort} onSort={toggleSort} />
      ) : (
        <CardsView rows={list} ctx={ctx} />
      )}

      {list.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nada aqui.
        </p>
      )}
    </div>
  );
}
