"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
const money2 = (n: number) => n.toFixed(2).replace(".", ",");

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
//  Campo de custo — digitar direto OU "por lote" (total ÷ quantidade)
// =======================================================================

function LotCost({
  value,
  onChange,
  wide,
}: {
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  const [lot, setLot] = useState(false);
  const [total, setTotal] = useState("");
  const [qty, setQty] = useState("");

  const t = money(total);
  const q = Number(qty.replace(",", "."));
  const unit = t != null && q > 0 ? t / q : null;

  function apply(nextTotal: string, nextQty: string) {
    const tt = money(nextTotal);
    const qq = Number(nextQty.replace(",", "."));
    if (tt != null && qq > 0) onChange(money2(tt / qq));
  }

  if (lot) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <div className="flex w-[4.5rem] items-center rounded-lg border border-border bg-background">
          <span className="pl-1.5 text-[10px] text-muted">R$</span>
          <input
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              apply(e.target.value, qty);
            }}
            inputMode="decimal"
            placeholder="total"
            autoFocus
            className="h-9 w-full bg-transparent px-1 text-sm outline-none"
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
          placeholder="qtd"
          className="h-9 w-12 rounded-lg border border-border bg-background px-1 text-center text-sm outline-none"
        />
        <span className="font-semibold">= {unit != null ? `R$ ${money2(unit)}` : "—"}</span>
        <button
          type="button"
          onClick={() => setLot(false)}
          className="rounded-md border border-border px-1.5 py-1 text-[11px] font-semibold"
        >
          ok
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "flex items-center rounded-lg border border-border bg-background",
          wide ? "w-24" : "w-20",
        )}
      >
        <span className="pl-2 text-xs text-muted">R$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="—"
          className="h-9 w-full bg-transparent px-1 text-sm font-semibold outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => setLot(true)}
        title="Calcular o custo unitário a partir do valor total da compra"
        className="whitespace-nowrap text-[11px] font-semibold text-primary"
      >
        por lote
      </button>
    </div>
  );
}

// =======================================================================

type Filter = "all" | "nocost" | "low" | "promo";
type View = "cards" | "table";
type SortKey = "name" | "price" | "margin" | "sold";
type Sort = { key: SortKey | null; dir: "asc" | "desc" };

type RowCtx = {
  settings: PricingSettings;
  d: (r: PricingRow) => { cost: string; price: string };
  setD: (r: PricingRow, patch: Partial<{ cost: string; price: string }>) => void;
  save: (r: PricingRow) => void;
  saving: Record<string, boolean>;
  saved: Record<string, boolean>;
};

function rowState(r: PricingRow, ctx: RowCtx) {
  const cur = ctx.d(r);
  const costN = cur.cost === "" ? null : money(cur.cost);
  const priceN = money(cur.price) ?? r.priceMin;
  const m = calc(priceN, costN, ctx.settings);
  const multi = r.price == null;
  const dirty =
    cur.cost !== (r.cost != null ? String(r.cost) : "") ||
    (!multi && cur.price !== (r.price != null ? String(r.price) : ""));
  const canBump = !multi && m.suggested != null && m.suggested > priceN + 0.01;
  return { cur, costN, priceN, m, multi, dirty, canBump };
}

function SaveBtn({
  r,
  dirty,
  ctx,
  className,
}: {
  r: PricingRow;
  dirty: boolean;
  ctx: RowCtx;
  className?: string;
}) {
  return (
    <Button
      size="sm"
      variant={dirty ? "primary" : "ghost"}
      disabled={!dirty || ctx.saving[r.productId]}
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

// ---- visão em cartões -------------------------------------------------

function CardsView({ rows, ctx }: { rows: PricingRow[]; ctx: RowCtx }) {
  const { settings } = ctx;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const { cur, m, multi, dirty, canBump, priceN } = rowState(r, ctx);
        return (
          <div key={r.productId} className="rounded-2xl border border-border bg-surface p-3">
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
              <div className="text-xs">
                <span className="text-muted">Custo</span>
                <div className="mt-1">
                  <LotCost value={cur.cost} onChange={(v) => ctx.setD(r, { cost: v })} wide />
                </div>
              </div>

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
                      onChange={(e) => ctx.setD(r, { price: e.target.value })}
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

              {canBump && (
                <button
                  type="button"
                  onClick={() => ctx.setD(r, { price: String(m.suggested) })}
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

              <SaveBtn r={r} dirty={dirty} ctx={ctx} className="ml-auto w-[70px]" />
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
    </div>
  );
}

// ---- visão em tabela -------------------------------------------------

function SortTh({
  k,
  sort,
  onSort,
  children,
}: {
  k: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  children: ReactNode;
}) {
  const active = sort.key === k;
  return (
    <th className="px-2 py-2 font-semibold">
      <button type="button" onClick={() => onSort(k)} className="hover:text-foreground">
        {children}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
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
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            <SortTh k="name" sort={sort} onSort={onSort}>Produto</SortTh>
            <th className="px-2 py-2 font-semibold">Custo</th>
            <SortTh k="price" sort={sort} onSort={onSort}>Preço</SortTh>
            <SortTh k="margin" sort={sort} onSort={onSort}>Margem</SortTh>
            <th className="px-2 py-2 font-semibold">Mín. · markup</th>
            <SortTh k="sold" sort={sort} onSort={onSort}>Vendas</SortTh>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const { cur, m, multi, dirty, canBump } = rowState(r, ctx);
            return (
              <tr
                key={r.productId}
                className="border-b border-border/60 align-top last:border-0"
              >
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-black/5">
                      {r.imageUrl ? (
                        <Image src={r.imageUrl} alt="" fill sizes="32px" className="object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted">
                          <ImageOff className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/produtos/${r.productId}`}
                        className="line-clamp-1 font-semibold hover:text-primary"
                      >
                        {r.name}
                      </Link>
                      <p className="text-[11px] text-muted">
                        {r.categoryName}
                        {!r.active && " · inativo"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-2 py-2">
                  <LotCost value={cur.cost} onChange={(v) => ctx.setD(r, { cost: v })} />
                </td>

                <td className="px-2 py-2">
                  {multi ? (
                    <span className="whitespace-nowrap text-xs text-muted">
                      {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
                    </span>
                  ) : (
                    <div className="flex w-[4.5rem] items-center rounded-lg border border-border bg-background">
                      <span className="pl-1.5 text-[10px] text-muted">R$</span>
                      <input
                        value={cur.price}
                        onChange={(e) => ctx.setD(r, { price: e.target.value })}
                        inputMode="decimal"
                        className="h-9 w-full bg-transparent px-1 text-sm font-semibold outline-none"
                      />
                    </div>
                  )}
                  {canBump && (
                    <button
                      type="button"
                      onClick={() => ctx.setD(r, { price: String(m.suggested) })}
                      title={`Subir para ${ctx.settings.targetMarginPercent}% de margem`}
                      className="mt-1 block whitespace-nowrap rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning"
                    >
                      ↑ {money2(m.suggested!)}
                    </button>
                  )}
                </td>

                <td className="px-2 py-2">
                  <span
                    className={cn(
                      "inline-block rounded-md px-1.5 py-0.5 text-xs font-bold",
                      toneOf(m.marginPct),
                    )}
                  >
                    {m.marginPct != null ? `${m.marginPct.toFixed(0)}%` : "—"}
                  </span>
                  <p className="mt-0.5 text-[11px] text-muted">{brl(m.margin)}</p>
                </td>

                <td className="whitespace-nowrap px-2 py-2 text-[11px] text-muted">
                  {brl(m.min)}
                  {m.markup != null && (
                    <>
                      <br />
                      {m.markup.toFixed(1)}×
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap px-2 py-2 text-[11px] text-muted">
                  {r.unitsSold > 0 ? (
                    <>
                      {r.unitsSold} un.
                      <br />
                      {brl(r.profitToDate)}
                    </>
                  ) : (
                    "—"
                  )}
                </td>

                <td className="px-2 py-2">
                  <SaveBtn r={r} dirty={dirty} ctx={ctx} className="w-[64px]" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =======================================================================

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
  const [view, setView] = useState<View>("cards");
  const [sort, setSort] = useState<Sort>({ key: null, dir: "asc" });
  const [draft, setDraft] = useState<Record<string, { cost: string; price: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // preferência salva no navegador — lida após montar pra não quebrar a hidratação
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
      if (filter === "low") return (r.math?.marginPct ?? 100) < 30;
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
            ? r.math?.marginPct ?? 9999
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

  const ctx: RowCtx = { settings, d, setD, save, saving, saved };

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
