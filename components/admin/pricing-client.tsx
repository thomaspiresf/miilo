"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ImageOff, Plus, Search, Trash2 } from "lucide-react";
import type { PricingSettings } from "@/lib/types";
import type { BusinessHealth, PricingRow } from "@/lib/data/pricing";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import {
  savePricingSettingsAction,
  setProductPricingAction,
} from "@/app/admin/precificacao/actions";

// ---- mesma conta do servidor (lib/data/pricing.ts computePrice) --------
function niceUp(n: number) {
  if (n <= 0) return 0;
  const base = Math.ceil(n);
  return base - 0.1 < n ? base + 0.9 : base - 0.1;
}
function calc(price: number, cost: number | null, s: PricingSettings) {
  const drain = (s.mpCreditPercent + s.taxPercent) / 100;
  if (cost == null || !(price > 0)) {
    return { margin: null, marginPct: null, markup: null, min: null, suggested: null };
  }
  const variable = cost + price * drain + s.packagingCost;
  const margin = price - variable;
  const marginPct = (margin / price) * 100;
  const markup = cost > 0 ? (price - cost) / cost : null;
  const min = drain < 1 ? (cost + s.packagingCost) / (1 - drain) : null;
  const tm = s.targetMarginPercent / 100;
  const suggested = drain + tm < 1 ? niceUp((cost + s.packagingCost) / (1 - drain - tm)) : null;
  return { margin, marginPct, markup, min, suggested };
}
function toneOf(pct: number | null) {
  if (pct == null) return "bg-black/[0.06] text-muted";
  if (pct < 30) return "bg-danger/10 text-danger ring-1 ring-inset ring-danger/20";
  if (pct < 45) return "bg-warning/15 text-warning ring-1 ring-inset ring-warning/25";
  return "bg-success/10 text-success ring-1 ring-inset ring-success/20";
}
const brl = (n: number | null) => (n == null ? "—" : formatBRL(n));
const money = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

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

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <label className="text-xs">
      <span className="text-muted">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-background">
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="h-9 w-full bg-transparent px-2 text-sm outline-none"
        />
        <span className="px-2 text-xs text-muted">{suffix}</span>
      </div>
    </label>
  );
}

function SettingsPanel({ initial }: { initial: PricingSettings }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function num(key: keyof PricingSettings, v: string) {
    const n = Number(v.replace(",", "."));
    setS((p) => ({ ...p, [key]: Number.isFinite(n) ? n : 0 }));
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
    }
  }

  const totalFixed = s.fixedCosts.reduce((a, f) => a + (f.amount || 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="font-black">Regras de precificação</span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField label="Imposto sobre a venda" value={s.taxPercent} onChange={(v) => num("taxPercent", v)} suffix="%" />
            <NumField label="Margem-alvo (preço sugerido)" value={s.targetMarginPercent} onChange={(v) => num("targetMarginPercent", v)} suffix="%" />
            <NumField label="Embalagem por pedido" value={s.packagingCost} onChange={(v) => num("packagingCost", v)} suffix="R$" />
            <NumField label="Taxa MP — crédito" value={s.mpCreditPercent} onChange={(v) => num("mpCreditPercent", v)} suffix="%" />
            <NumField label="Taxa MP — Pix" value={s.mpPixPercent} onChange={(v) => num("mpPixPercent", v)} suffix="%" />
            <NumField label="Taxa MP — débito" value={s.mpDebitPercent} onChange={(v) => num("mpDebitPercent", v)} suffix="%" />
          </div>
          <p className="text-[11px] text-muted">
            A margem na tabela usa a taxa de <strong>crédito</strong> (pior caso comum).
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              Custos fixos mensais {totalFixed > 0 && `· ${formatBRL(totalFixed)}/mês`}
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
                  <div className="flex w-28 items-center rounded-lg border border-border bg-background">
                    <span className="pl-2 text-xs text-muted">R$</span>
                    <input
                      value={String(f.amount ?? "")}
                      onChange={(e) => {
                        const next = [...s.fixedCosts];
                        next[i] = { ...f, amount: Number(e.target.value.replace(",", ".")) || 0 };
                        setS((p) => ({ ...p, fixedCosts: next }));
                      }}
                      inputMode="decimal"
                      className="h-9 w-full bg-transparent px-1 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setS((p) => ({
                        ...p,
                        fixedCosts: p.fixedCosts.filter((_, j) => j !== i),
                      }))
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setS((p) => ({
                    ...p,
                    fixedCosts: [...p.fixedCosts, { label: "", amount: 0 }],
                  }))
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

type Filter = "all" | "nocost" | "low" | "promo";

export function PricingClient({
  rows,
  settings,
  health,
}: {
  rows: PricingRow[];
  settings: PricingSettings;
  health: BusinessHealth;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Record<string, { cost: string; price: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

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
      if (filter === "low") return (r.math?.marginPct ?? 100) < 30;
      if (filter === "promo") return r.compareAt != null;
      return true;
    });
  }, [rows, term, filter]);

  const counts = {
    nocost: rows.filter((r) => r.cost == null).length,
    low: rows.filter((r) => (r.math?.marginPct ?? 100) < 30).length,
  };

  function base(r: PricingRow) {
    return {
      cost: r.cost != null ? String(r.cost) : "",
      price: r.price != null ? String(r.price) : "",
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
    const cost = cur.cost === "" ? null : money(cur.cost);
    const price = cur.price === "" ? undefined : money(cur.price);
    if (cur.cost !== "" && cost == null) return setError("Custo inválido");
    if (cur.price !== "" && price == null) return setError("Preço inválido");

    const payload: {
      productId: string;
      cost?: number | null;
      price?: number;
    } = { productId: r.productId };
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

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `Todos (${rows.length})` },
    { id: "nocost", label: `Sem custo (${counts.nocost})` },
    { id: "low", label: `Margem baixa (${counts.low})` },
    { id: "promo", label: "Em promoção" },
  ];

  return (
    <div className="space-y-4">
      <HealthCard h={health} />
      <SettingsPanel initial={settings} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="space-y-2.5">
        {filtered.map((r) => {
          const cur = d(r);
          const costN = cur.cost === "" ? null : money(cur.cost);
          const priceN = money(cur.price) ?? r.priceMin;
          const m = calc(priceN, costN, settings);
          const multi = r.price == null;
          const dirty =
            cur.cost !== (r.cost != null ? String(r.cost) : "") ||
            (!multi && cur.price !== (r.price != null ? String(r.price) : ""));

          return (
            <div
              key={r.productId}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/produtos/${r.productId}`}
                    className="line-clamp-1 text-sm font-bold hover:text-primary"
                  >
                    {r.name}
                  </Link>
                  <p className="text-[11px] text-muted">
                    {r.categoryName}
                    {r.unitsSold > 0 && ` · vendeu ${r.unitsSold}`}
                    {r.profitToDate != null && ` · lucro ${brl(r.profitToDate)}`}
                    {!r.active && " · inativo"}
                  </p>
                </div>
                <span
                  className={cn(
                    "h-fit shrink-0 rounded-md px-2 py-1 text-xs font-bold",
                    toneOf(m.marginPct),
                  )}
                >
                  {m.marginPct != null ? `${m.marginPct.toFixed(0)}%` : "sem custo"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs">
                  <span className="text-muted">Custo</span>
                  <div className="mt-1 flex w-24 items-center rounded-lg border border-border bg-background">
                    <span className="pl-2 text-xs text-muted">R$</span>
                    <input
                      value={cur.cost}
                      onChange={(e) => setD(r, { cost: e.target.value })}
                      inputMode="decimal"
                      placeholder="—"
                      className="h-9 w-full bg-transparent px-1 text-sm font-semibold outline-none"
                    />
                  </div>
                </label>

                <label className="text-xs">
                  <span className="text-muted">Preço</span>
                  {multi ? (
                    <p className="mt-1 flex h-9 items-center text-sm font-semibold">
                      {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
                    </p>
                  ) : (
                    <div className="mt-1 flex w-24 items-center rounded-lg border border-border bg-background">
                      <span className="pl-2 text-xs text-muted">R$</span>
                      <input
                        value={cur.price}
                        onChange={(e) => setD(r, { price: e.target.value })}
                        inputMode="decimal"
                        className="h-9 w-full bg-transparent px-1 text-sm font-semibold outline-none"
                      />
                    </div>
                  )}
                </label>

                <div className="text-xs leading-tight text-muted">
                  <p>Margem {brl(m.margin)}</p>
                  <p>
                    Mín {brl(m.min)}
                    {m.markup != null && ` · markup ${m.markup.toFixed(1)}×`}
                  </p>
                </div>

                {!multi && m.suggested != null && m.suggested > priceN + 0.01 && (
                  <button
                    type="button"
                    onClick={() => setD(r, { price: String(m.suggested) })}
                    title={`Preço pra bater ${settings.targetMarginPercent}% de margem`}
                    className="rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15"
                  >
                    Subir p/ {formatBRL(m.suggested!)}
                  </button>
                )}
                {!multi &&
                  m.marginPct != null &&
                  m.marginPct >= settings.targetMarginPercent &&
                  m.suggested != null &&
                  m.suggested < priceN - 0.01 && (
                    <span
                      className="text-[11px] text-muted"
                      title={`Preço mínimo pra ${settings.targetMarginPercent}% de margem`}
                    >
                      alvo já batido (min {formatBRL(m.suggested)})
                    </span>
                  )}

                <Button
                  size="sm"
                  variant={dirty ? "primary" : "ghost"}
                  disabled={!dirty || saving[r.productId]}
                  onClick={() => save(r)}
                  className="ml-auto w-[70px]"
                >
                  {saving[r.productId] ? (
                    <Spinner />
                  ) : saved[r.productId] ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>

              {multi && (
                <p className="mt-2 text-[11px] text-muted">
                  Preços variam por variação — edite na{" "}
                  <Link href={`/admin/produtos/${r.productId}`} className="text-primary">
                    tela do produto
                  </Link>
                  .
                </p>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Nada aqui.
          </p>
        )}
      </div>
    </div>
  );
}
