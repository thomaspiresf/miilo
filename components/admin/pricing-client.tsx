"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ImageOff, Plus, Search, Trash2 } from "lucide-react";
import type { PricingSettings } from "@/lib/types";
import type { BusinessHealth, PricingRow } from "@/lib/data/pricing";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { computeMargins, suggestForContribution } from "@/lib/pricing-math";
import {
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
  const router = useRouter();
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
//  Simulador — testar um produto antes de comprar
// =======================================================================

function SimResult({
  label,
  cost,
  price,
  settings,
  target,
  big,
}: {
  label: string;
  cost: number;
  price: number;
  settings: PricingSettings;
  target: number;
  big?: boolean;
}) {
  const m = computeMargins(cost, price, settings);
  const cp = m.contribPct ?? 0;
  const tone =
    cp <= 0
      ? { c: "text-danger", i: "🔴", t: "Prejuízo — você paga pra vender." }
      : cp < target
        ? { c: "text-warning", i: "⚠️", t: `Contribuição abaixo da meta de ${target}%.` }
        : { c: "text-success", i: "✅", t: "Contribuição dentro da meta." };
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("font-black", big ? "text-2xl" : "text-lg")}>{formatBRL(price)}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted">
          bruta <span className="font-semibold text-foreground">{pctStr(m.grossPct)}</span>
        </span>
        <span className={cn("font-semibold", tone.c)}>
          {tone.i} contribuição {pctStr(m.contribPct)} ({brl(m.contribValue)})
        </span>
        <span className="text-muted">
          markup <span className="font-semibold text-foreground">{fmt1(m.markup ?? 0)}×</span>
        </span>
      </div>
      <p className="text-[11px] text-muted">{tone.t}</p>
      {big && (
        <p className="mt-1 text-[11px] text-muted">
          preço mínimo (contribuição zero): {brl(m.minPrice)}
        </p>
      )}
    </div>
  );
}

function PriceSimulator({ settings }: { settings: PricingSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [tm, setTm] = useState(String(settings.targetMarginPercent));
  const [pk, setPk] = useState(fmt2(settings.packagingCost));
  const [testPrice, setTestPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const costN = num(cost);
  const tmN = num(tm) ?? settings.targetMarginPercent;
  const pkN = num(pk) ?? 0;
  // regras "de teste" — sobrepõe margem-alvo e embalagem sem salvar
  const simSettings: PricingSettings = {
    ...settings,
    targetMarginPercent: tmN,
    packagingCost: pkN,
  };
  const suggested =
    costN != null ? suggestForContribution(costN, simSettings, tmN) : null;
  const testN = num(testPrice);

  const changed =
    Math.abs(tmN - settings.targetMarginPercent) > 0.001 ||
    Math.abs(pkN - settings.packagingCost) > 0.001;

  async function saveDefaults() {
    setSaving(true);
    await savePricingSettingsAction({
      ...settings,
      targetMarginPercent: tmN,
      packagingCost: pkN,
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="font-black">Simular preço</span>
        <span className="hidden text-[11px] text-muted sm:inline">
          testar um produto antes de comprar
        </span>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Comprei por (unidade)
            </p>
            <div className="mt-0.5">
              <CostField value={cost} onChange={setCost} big />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              margem-alvo
              <Ghost value={tm} onChange={setTm} suffix="%" ch={2.5} className="text-foreground" />
            </span>
            <span className="inline-flex items-center gap-1">
              embalagem
              <Ghost value={pk} onChange={setPk} prefix="R$" ch={3.5} className="text-foreground" />
            </span>
            <span>+ taxa crédito {settings.mpCreditPercent}% + imposto {settings.taxPercent}% (= margem de contribuição)</span>
            {changed && (
              <button
                type="button"
                onClick={saveDefaults}
                disabled={saving}
                className="font-semibold text-primary"
              >
                {saving ? "salvando…" : "salvar como padrão"}
              </button>
            )}
          </div>

          {costN == null || suggested == null ? (
            <p className="text-xs text-muted">Digite o custo pra ver o preço sugerido.</p>
          ) : (
            <div className="space-y-3 rounded-xl bg-black/[0.03] p-4">
              <SimResult
                label={`Preço sugerido pra ${tmN}% de contribuição`}
                cost={costN}
                price={suggested}
                settings={simSettings}
                target={tmN}
                big
              />
              <div className="border-t border-border pt-3">
                <label className="text-xs text-muted">
                  E se eu vender por{" "}
                  <Ghost
                    value={testPrice}
                    onChange={setTestPrice}
                    prefix="R$"
                    ch={5}
                    className="font-bold text-foreground"
                    placeholder="…"
                  />
                </label>
                {testN != null && (
                  <div className="mt-1.5">
                    <SimResult
                      label="Nesse preço"
                      cost={costN}
                      price={testN}
                      settings={simSettings}
                      target={tmN}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
      <div className="text-xs">
        <div className="flex items-center gap-1">
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
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span className="font-semibold text-foreground">
            {unit != null ? `= R$ ${fmt2(unit)}/un` : "= —"}
          </span>
          <button type="button" onClick={() => setLot(false)} className="font-semibold text-primary">
            ok
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className={cn(big ? "text-base font-bold" : "text-sm font-semibold")}>
        <Ghost value={value} onChange={onChange} prefix="R$" ch={big ? 5.5 : 5} />
      </span>
      <button
        type="button"
        onClick={() => setLot(true)}
        title="Calcular o custo unitário pelo valor total da compra"
        className="mt-0.5 block text-[11px] font-semibold text-primary"
      >
        por lote
      </button>
    </div>
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

function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function CardRow({ r, ctx }: { r: PricingRow; ctx: RowCtx }) {
  const p = usePriceRow(r, ctx);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
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
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 sm:gap-5">
          <MiniStat label="Compra">
            <CostField value={p.cur.cost} onChange={p.setCost} big />
          </MiniStat>

          <ArrowRight className="mt-6 h-4 w-4 shrink-0 text-muted" />

          <MiniStat label="Venda">
            <div className="text-base font-bold">
              {p.multi ? (
                <span>
                  {formatBRL(r.priceMin)}–{formatBRL(r.priceMax)}
                </span>
              ) : (
                <Ghost value={p.cur.price} onChange={p.setPrice} prefix="R$" ch={5.5} />
              )}
            </div>
          </MiniStat>
        </div>

        <SaveBtn r={r} p={p} ctx={ctx} className="w-[72px]" />
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        {p.multi ? (
          <p className="text-[11px] text-muted">
            Preços variam por variação —{" "}
            <Link href={`/admin/produtos/${r.productId}`} className="text-primary">
              editar na tela do produto
            </Link>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
              <MiniStat label="M. bruta">
                <GrossCell p={p} />
              </MiniStat>
              <MiniStat label="M. contribuição">
                <ContribCell p={p} showValue />
              </MiniStat>
              <MiniStat label="Markup">
                <MarkupCell p={p} />
              </MiniStat>
              <MiniStat label="Preço mínimo">
                <span className="text-sm font-semibold">{brl(p.m.minPrice)}</span>
              </MiniStat>
            </div>
            <div className="mt-1.5">
              <BumpLink p={p} ctx={ctx} />
            </div>
          </>
        )}
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

  return (
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
        <SaveBtn r={r} p={p} ctx={ctx} className="w-[68px]" />
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
