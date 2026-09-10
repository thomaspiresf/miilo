"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ImageOff, Minus, Plus, Search } from "lucide-react";
import type { VariantStockRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

type Filter = "all" | "low" | "out";

function stockTone(stock: number) {
  if (stock === 0) return "bg-danger/10 text-danger ring-danger/20";
  if (stock === 1) return "bg-warning/15 text-warning ring-warning/25";
  return "bg-success/10 text-success ring-success/20";
}

function ThumbLink({
  productId,
  src,
  alt,
  size = 48,
}: {
  productId: string;
  src: string | null;
  alt: string;
  size?: number;
}) {
  return (
    <Link
      href={`/admin/produtos/${productId}`}
      title="Abrir produto"
      className="relative block shrink-0 overflow-hidden rounded-lg border border-border bg-black/[0.03]"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <ImageOff className="h-4 w-4" />
        </div>
      )}
    </Link>
  );
}

function Swatch({ hex }: { hex: string | null }) {
  if (!hex) return null;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
      style={{ background: hex }}
    />
  );
}

function StockChip({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "grid h-7 min-w-7 shrink-0 place-items-center rounded-md px-1.5 text-xs font-bold ring-1 ring-inset",
        stockTone(n),
      )}
    >
      {n}
    </span>
  );
}

type ProductGroup = {
  productId: string;
  productName: string;
  productActive: boolean;
  image: string | null;
  total: number;
  outCount: number;
  variantCount: number;
  colors: {
    color: string | null;
    hex: string | null;
    items: VariantStockRow[];
  }[];
};

export function StockTable({
  rows: initial,
  initialFilter = "all",
}: {
  rows: VariantStockRow[];
  initialFilter?: Filter;
}) {
  const [rows, setRows] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  // ids que o usuário abriu / fechou à mão (o padrão depende de estar filtrando)
  const [userOpen, setUserOpen] = useState<Set<string>>(new Set());
  const [userClosed, setUserClosed] = useState<Set<string>>(new Set());

  const term = q.trim().toLowerCase();
  const browsing = term !== "" || filter !== "all";

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        term &&
        !r.productName.toLowerCase().includes(term) &&
        !(r.sku ?? "").toLowerCase().includes(term) &&
        !(r.color ?? "").toLowerCase().includes(term)
      )
        return false;
      if (filter === "out") return r.stock === 0;
      if (filter === "low") return r.stock === 1;
      return true;
    });
  }, [rows, term, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      low: rows.filter((r) => r.stock === 1).length,
      out: rows.filter((r) => r.stock === 0).length,
      units: rows.reduce((s, r) => s + r.stock, 0),
    }),
    [rows],
  );

  // quantas variações o produto tem no total (independe de filtro)
  const totalByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.productId, (m.get(r.productId) ?? 0) + 1);
    return m;
  }, [rows]);

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const r of filtered) {
      let g = map.get(r.productId);
      if (!g) {
        g = {
          productId: r.productId,
          productName: r.productName,
          productActive: r.productActive,
          image: r.imageUrl,
          total: 0,
          outCount: 0,
          variantCount: 0,
          colors: [],
        };
        map.set(r.productId, g);
      }
      g.total += r.stock;
      g.variantCount += 1;
      if (r.stock === 0) g.outCount += 1;
      const key = (r.color ?? "").toLowerCase();
      let c = g.colors.find((x) => (x.color ?? "").toLowerCase() === key);
      if (!c) {
        c = { color: r.color, hex: r.colorHex, items: [] };
        g.colors.push(c);
      }
      c.items.push(r);
    }
    return [...map.values()];
  }, [filtered]);

  function draftFor(r: VariantStockRow) {
    return drafts[r.variantId] ?? r.stock;
  }
  function setDraft(id: string, v: number) {
    setDrafts((d) => ({ ...d, [id]: Math.max(0, Math.round(v || 0)) }));
    setSaved((s) => ({ ...s, [id]: false }));
  }
  // padrão: aberto quando está filtrando/buscando, fechado quando não
  function isGroupOpen(id: string) {
    if (userOpen.has(id)) return true;
    if (userClosed.has(id)) return false;
    return browsing;
  }
  function resetToggles() {
    setUserOpen(new Set());
    setUserClosed(new Set());
  }
  function toggle(id: string) {
    const open = isGroupOpen(id);
    setUserOpen((s) => {
      const n = new Set(s);
      if (open) n.delete(id);
      else n.add(id);
      return n;
    });
    setUserClosed((s) => {
      const n = new Set(s);
      if (open) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function save(r: VariantStockRow) {
    const next = draftFor(r);
    if (next === r.stock) return;
    setSaving((s) => ({ ...s, [r.variantId]: true }));
    setError(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: r.variantId, stock: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setRows((rs) =>
        rs.map((x) => (x.variantId === r.variantId ? { ...x, stock: data.stock } : x)),
      );
      setDrafts((d) => {
        const c = { ...d };
        delete c[r.variantId];
        return c;
      });
      setSaved((s) => ({ ...s, [r.variantId]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [r.variantId]: false })), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving((s) => ({ ...s, [r.variantId]: false }));
    }
  }

  function Stepper({ r }: { r: VariantStockRow }) {
    const d = draftFor(r);
    const dirty = d !== r.stock;
    return (
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-background">
          <button
            type="button"
            onClick={() => setDraft(r.variantId, d - 1)}
            className="grid h-9 w-9 place-items-center text-muted hover:text-foreground"
            aria-label="Diminuir"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            value={d}
            onChange={(e) => setDraft(r.variantId, Number(e.target.value))}
            inputMode="numeric"
            className="h-9 w-11 border-x border-border text-center text-sm font-bold outline-none"
          />
          <button
            type="button"
            onClick={() => setDraft(r.variantId, d + 1)}
            className="grid h-9 w-9 place-items-center text-muted hover:text-foreground"
            aria-label="Aumentar"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button
          size="sm"
          variant={dirty ? "primary" : "ghost"}
          disabled={!dirty || saving[r.variantId]}
          onClick={() => save(r)}
          className="w-[68px] shrink-0"
        >
          {saving[r.variantId] ? (
            <Spinner />
          ) : saved[r.variantId] ? (
            <Check className="h-4 w-4" />
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    );
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `Tudo (${counts.all})` },
    { id: "low", label: `Última peça (${counts.low})` },
    { id: "out", label: `Esgotado (${counts.out})` },
  ];

  return (
    <div>
      {/* resumo */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
          <p className="text-xl font-black leading-none">{counts.units}</p>
          <p className="mt-1 text-xs text-muted">unidades no estoque</p>
        </div>
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-center",
            counts.out ? "border-danger/30 bg-danger/10" : "border-border bg-surface",
          )}
        >
          <p className="text-xl font-black leading-none">{counts.out}</p>
          <p className="mt-1 text-xs text-muted">variações esgotadas</p>
        </div>
      </div>

      {/* busca + filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center rounded-full border border-border bg-surface px-3 sm:max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetToggles();
            }}
            placeholder="Buscar produto, cor ou SKU"
            className="h-10 w-full bg-transparent px-2 text-sm outline-none"
          />
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setFilter(t.id);
                resetToggles();
              }}
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
        <p className="mb-3 rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {groups.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nada aqui.
        </p>
      )}

      <div className="space-y-2.5">
        {groups.map((g) => {
          // linha inline (chip + rótulo + stepper) quando só há UMA variação
          // pra mexer: produto de 1 variação só, ou só 1 bateu o filtro
          const total = totalByProduct.get(g.productId) ?? g.variantCount;
          const inline =
            total === 1 || g.variantCount === 1
              ? (g.colors[0]?.items[0] ?? null)
              : null;
          const inlineLabel =
            inline && (inline.size || inline.color)
              ? [inline.size, inline.color].filter(Boolean).join(" · ")
              : "Único";
          const collapsible = !inline;
          const isOpen = collapsible && isGroupOpen(g.productId);

          return (
            <div
              key={g.productId}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {/* cabeçalho */}
              <div
                className={cn(
                  "flex items-center gap-3 p-3",
                  inline ? "flex-wrap" : "",
                )}
              >
                <ThumbLink
                  productId={g.productId}
                  src={g.image}
                  alt={g.productName}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/produtos/${g.productId}`}
                    className="line-clamp-2 text-sm font-bold leading-snug hover:text-primary"
                  >
                    {g.productName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    {!inline && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-bold ring-1 ring-inset",
                          stockTone(g.total),
                        )}
                      >
                        {g.total} un.
                      </span>
                    )}
                    {g.colors.length > 1 && <span>{g.colors.length} cores</span>}
                    {!inline && g.outCount > 0 && (
                      <span className="font-semibold text-danger">
                        {g.outCount} esgotad{g.outCount > 1 ? "as" : "a"}
                      </span>
                    )}
                    {!g.productActive && (
                      <span className="font-semibold text-danger">inativo</span>
                    )}
                    {g.colors.length > 1 && (
                      <span className="flex items-center gap-1">
                        {g.colors.slice(0, 10).map((c, i) => (
                          <Swatch key={i} hex={c.hex} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {inline ? (
                  <div className="ml-[60px] flex w-full items-center gap-2 sm:ml-0 sm:w-auto">
                    <StockChip n={inline.stock} />
                    <span className="mr-auto flex items-center gap-1.5 text-sm text-muted sm:mr-0">
                      {inline.colorHex && <Swatch hex={inline.colorHex} />}
                      {inlineLabel}
                    </span>
                    <Stepper r={inline} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(g.productId)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-black/[0.04]"
                    aria-label={isOpen ? "Fechar" : "Abrir"}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                )}
              </div>

              {/* variações (multi) */}
              {isOpen && (
                <div className="divide-y divide-border border-t border-border">
                  {g.colors.map((c, ci) => (
                    <div key={ci} className="flex gap-3 p-3">
                      {c.color ? (
                        <div className="grid h-10 w-10 shrink-0 place-items-center">
                          <span
                            className={cn(
                              "h-6 w-6 rounded-full border",
                              c.hex ? "border-black/10" : "border-dashed border-border",
                            )}
                            style={c.hex ? { background: c.hex } : undefined}
                          />
                        </div>
                      ) : (
                        <div className="hidden w-10 shrink-0 sm:block" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {c.color && <p className="text-xs font-semibold">{c.color}</p>}
                        {c.items.map((r) => (
                          <div
                            key={r.variantId}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <StockChip n={r.stock} />
                              <span className="truncate text-sm">
                                {r.size ?? (c.color ? "—" : "Único")}
                              </span>
                            </div>
                            <Stepper r={r} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
