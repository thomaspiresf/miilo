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

// ---- conta (espelha lib/data/pricing.ts computePrice) -----------------
function niceUp(n: number) {
  if (n <= 0) return 0;
  const base = Math.ceil(n);
  return base - 0.1 < n ? base + 0.9 : base - 0.1;
}
function toneOf(pct: number | null) {
  if (pct == null) return "bg-black/[0.06] text-muted";
  if (pct < 30) return "bg-danger/10 text-danger ring-1 ring-inset ring-danger/20";
  if (pct < 45) return "bg-warning/15 text-warning ring-1 ring-inset ring-warning/25";
  return "bg-success/10 text-success ring-1 ring-inset ring-success/20";
}
function borderTone(pct: number | null) {
  if (pct == null) return "border-border";
  if (pct < 30) return "border-danger/40";
  if (pct < 45) return "border-warning/50";
  return "border-success/40";
}
const brl = (n: number | null) => (n == null ? "—" : formatBRL(n));
const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
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

  function set(key: keyof PricingSettings, v: string) {
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
            <NumField label="Imposto sobre a venda" value={s.taxPercent} onChange={(v) => set("taxPercent", v)} suffix="%" />
            <NumField label="Margem-alvo (preço sugerido)" value={s.targetMarginPercent} onChange={(v) => set("targetMarginPercent", v)} suffix="%" />
            <NumField label="Embalagem por pedido" value={s.packagingCost} onChange={(v) => set("packagingCost", v)} suffix="R$" />
            <NumField label="Taxa MP — crédito" value={s.mpCreditPercent} onChange={(v) => set("mpCreditPercent", v)} suffix="%" />
            <NumField label="Taxa MP — Pix" value={s.mpPixPercent} onChange={(v) => set("mpPixPercent", v)} suffix="%" />
            <NumField label="Taxa MP — débito" value={s.mpDebitPercent} onChange={(v) => set("mpDebitPercent", v)} suffix="%" />
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
                      setS((p) => ({ ...p, fixedCosts: p.fixedCosts.filter((_, j) => j !== i) }))
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
//  Estado editável de uma linha — custo, preço, margem % e markup são
//  interligados: mexe em qualquer um e os outros recalculam.
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
  const drain = (s.mpCreditPercent + s.taxPercent) / 100;
  const pk = s.packagingCost;
  const cur = ctx.d(r);
  const b = ctx.base(r);
  const multi = r.price == null;

  // enquanto o campo de margem/markup está sendo digitado, mostra o texto cru
  const [edit, setEdit] = useState<{ field: "margin" | "markup"; raw: string } | null>(null);

  const costN = cur.cost === "" ? null : num(cur.cost);
  const priceN = num(cur.price) ?? r.priceMin;

  const margin = costN != null ? priceN * (1 - drain) - costN - pk : null;
  const marginPct = margin != null && priceN > 0 ? (margin / priceN) * 100 : null;
  const mult = costN != null && costN > 0 ? priceN / costN : null; // preço ÷ custo
  const min = costN != null && drain < 1 ? (costN + pk) / (1 - drain) : null;

  const tm = s.targetMarginPercent / 100;
  const suggested =
    costN != null && drain + tm < 1 ? niceUp((costN + pk) / (1 - drain - tm)) : null;
  const canBump = !multi && suggested != null && suggested > priceN + 0.01;

  function setCost(v: string) {
    setEdit(null);
    ctx.setD(r, { cost: v });
  }
  function setPrice(v: string) {
    setEdit(null);
    ctx.setD(r, { price: v });
  }
  function driveMargin(v: string) {
    setEdit({ field: "margin", raw: v });
    const mp = num(v);
    if (mp != null && costN != null && drain + mp / 100 < 1) {
      ctx.setD(r, { price: fmt2(niceUp((costN + pk) / (1 - drain - mp / 100))) });
    }
  }
  function driveMarkup(v: string) {
    setEdit({ field: "markup", raw: v });
    const mk = num(v);
    if (mk != null && mk > 0 && costN != null) {
      ctx.setD(r, { price: fmt2(niceUp(costN * mk)) });
    }
  }
  function applyTarget() {
    if (suggested != null) {
      setEdit(null);
      ctx.setD(r, { price: fmt2(suggested) });
    }
  }
  const stopEditing = () => setEdit(null);

  const marginField =
    edit?.field === "margin"
      ? edit.raw
      : marginPct != null
        ? String(Math.round(marginPct))
        : "";
  const markupField =
    edit?.field === "markup" ? edit.raw : mult != null ? fmt1(mult) : "";

  const dirty = cur.cost !== b.cost || (!multi && cur.price !== b.price);
  const editable = !multi && costN != null;

  return {
    cur, multi, editable, costN, priceN,
    margin, marginPct, mult, min, suggested, canBump, dirty,
    marginField, markupField,
    setCost, setPrice, driveMargin, driveMarkup, applyTarget, stopEditing,
  };
}

// ---- campo de custo: digitar OU "por lote" (total ÷ quantidade) -------

function CostField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
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
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center gap-1 text-xs">
          <div className="flex w-16 items-center rounded-lg border border-border bg-background">
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
            className="h-9 w-11 rounded-lg border border-border bg-background px-1 text-center text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold">
            {unit != null ? `= R$ ${fmt2(unit)}/un` : "= —"}
          </span>
          <button
            type="button"
            onClick={() => setLot(false)}
            className="rounded-md border border-border px-1.5 py-0.5 font-semibold"
          >
            ok
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex w-24 items-center rounded-lg border border-border bg-background">
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
        className="mt-0.5 text-[11px] font-semibold text-primary"
      >
        por lote
      </button>
    </div>
  );
}

// ---- inputzinhos com sufixo ------------------------------------------

function SuffixInput({
  value,
  onChange,
  onBlur,
  suffix,
  disabled,
  className,
  placeholder = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suffix: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border-2 bg-background",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        inputMode="decimal"
        placeholder={placeholder}
        className="h-9 w-full bg-transparent px-2 text-center text-sm font-bold outline-none"
      />
      <span className="pr-1.5 text-xs text-muted">{suffix}</span>
    </div>
  );
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
    <p className="text-[11px] text-muted">
      {r.categoryName}
      {r.unitsSold > 0 && ` · vendeu ${r.unitsSold}`}
      {r.profitToDate != null && ` · lucro ${brl(r.profitToDate)}`}
      {!r.active && " · inativo"}
    </p>
  );
}

// ---- visão em cartões -----------------------------------------------

function CardRow({ r, ctx }: { r: PricingRow; ctx: RowCtx }) {
  const p = usePriceRow(r, ctx);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex gap-3">
        <Thumb url={r.imageUrl} size={44} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/produtos/${r.productId}`}
            className="line-clamp-1 text-sm font-bold hover:text-primary"
          >
            {r.name}
          </Link>
          <SubLine r={r} />
        </div>
        <span
          className={cn(
            "h-fit shrink-0 rounded-md px-2 py-1 text-xs font-bold",
            toneOf(p.marginPct),
          )}
        >
          {p.marginPct != null ? `${p.marginPct.toFixed(0)}%` : "sem custo"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
        <div>
          <p className="mb-1 text-[11px] text-muted">Custo</p>
          <CostField value={p.cur.cost} onChange={p.setCost} />
        </div>

        <div>
          <p className="mb-1 text-[11px] text-muted">Preço</p>
          {p.multi ? (
            <p className="flex h-9 items-center text-sm font-semibold">
              {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
            </p>
          ) : (
            <>
              <div className="flex w-24 items-center rounded-lg border-2 border-border bg-background">
                <span className="pl-2 text-xs text-muted">R$</span>
                <input
                  value={p.cur.price}
                  onChange={(e) => p.setPrice(e.target.value)}
                  inputMode="decimal"
                  className="h-9 w-full bg-transparent px-1 text-sm font-bold outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">mín {brl(p.min)}</p>
            </>
          )}
        </div>

        <div>
          <p className="mb-1 text-[11px] text-muted">Margem</p>
          <SuffixInput
            value={p.marginField}
            onChange={p.driveMargin}
            onBlur={p.stopEditing}
            suffix="%"
            disabled={!p.editable}
            className={cn("w-20", borderTone(p.marginPct))}
          />
          <p
            className={cn(
              "mt-1 text-[11px]",
              p.margin != null && p.margin < 0 ? "text-danger" : "text-muted",
            )}
          >
            {brl(p.margin)}
          </p>
        </div>

        <div>
          <p className="mb-1 text-[11px] text-muted">Markup</p>
          <SuffixInput
            value={p.markupField}
            onChange={p.driveMarkup}
            onBlur={p.stopEditing}
            suffix="×"
            disabled={!p.editable}
            className="w-20 border-border"
          />
          <p className="mt-1 text-[11px] text-muted">preço ÷ custo</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {p.canBump && (
          <button
            type="button"
            onClick={p.applyTarget}
            className="rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15"
          >
            Subir p/ {formatBRL(p.suggested!)} ({ctx.settings.targetMarginPercent}%)
          </button>
        )}
        {p.multi && (
          <p className="text-[11px] text-muted">
            Preços variam por variação —{" "}
            <Link href={`/admin/produtos/${r.productId}`} className="text-primary">
              editar na tela do produto
            </Link>
          </p>
        )}
        <SaveBtn r={r} dirty={p.dirty} ctx={ctx} className="ml-auto w-[70px]" />
      </div>
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

// ---- visão em tabela -----------------------------------------------

type SortKey = "name" | "price" | "margin" | "sold";
type Sort = { key: SortKey | null; dir: "asc" | "desc" };

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
    <th className="px-3 py-2.5 font-semibold">
      <button type="button" onClick={() => onSort(k)} className="hover:text-foreground">
        {children}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function TableRow({ r, ctx }: { r: PricingRow; ctx: RowCtx }) {
  const p = usePriceRow(r, ctx);

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Thumb url={r.imageUrl} size={36} />
          <div className="min-w-0">
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

      <td className="px-3 py-3">
        {p.multi ? (
          <span className="whitespace-nowrap text-xs text-muted">
            {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
          </span>
        ) : (
          <>
            <div className="flex w-24 items-center rounded-lg border-2 border-border bg-background">
              <span className="pl-2 text-xs text-muted">R$</span>
              <input
                value={p.cur.price}
                onChange={(e) => p.setPrice(e.target.value)}
                inputMode="decimal"
                className="h-9 w-full bg-transparent px-1 text-sm font-bold outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">mín {brl(p.min)}</p>
            {p.canBump && (
              <button
                type="button"
                onClick={p.applyTarget}
                title={`Subir para ${ctx.settings.targetMarginPercent}% de margem`}
                className="mt-1 whitespace-nowrap rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning"
              >
                ↑ {formatBRL(p.suggested!)}
              </button>
            )}
          </>
        )}
      </td>

      <td className="px-3 py-3">
        {p.marginPct == null ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <>
            <SuffixInput
              value={p.marginField}
              onChange={p.driveMargin}
              onBlur={p.stopEditing}
              suffix="%"
              disabled={!p.editable}
              className={cn("w-[4.25rem]", borderTone(p.marginPct))}
            />
            <p
              className={cn(
                "mt-1 text-[11px]",
                p.margin != null && p.margin < 0 ? "text-danger" : "text-muted",
              )}
            >
              {brl(p.margin)}
            </p>
          </>
        )}
      </td>

      <td className="px-3 py-3">
        {p.mult == null ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <SuffixInput
            value={p.markupField}
            onChange={p.driveMarkup}
            onBlur={p.stopEditing}
            suffix="×"
            disabled={!p.editable}
            className="w-[4.25rem] border-border"
          />
        )}
      </td>

      <td className="px-3 py-3">
        <SaveBtn r={r} dirty={p.dirty} ctx={ctx} className="w-[68px]" />
      </td>
    </tr>
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
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            <SortTh k="name" sort={sort} onSort={onSort}>Produto</SortTh>
            <th className="px-3 py-2.5 font-semibold">Custo</th>
            <SortTh k="price" sort={sort} onSort={onSort}>Preço</SortTh>
            <SortTh k="margin" sort={sort} onSort={onSort}>Margem</SortTh>
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
