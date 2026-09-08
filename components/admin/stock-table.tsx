"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Search } from "lucide-react";
import type { VariantStockRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

type Filter = "all" | "low" | "out";

const LOW = 3;

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.productName.toLowerCase().includes(term) && !(r.sku ?? "").toLowerCase().includes(term))
        return false;
      if (filter === "out") return r.stock === 0;
      if (filter === "low") return r.stock > 0 && r.stock <= LOW;
      return true;
    });
  }, [rows, q, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      low: rows.filter((r) => r.stock > 0 && r.stock <= LOW).length,
      out: rows.filter((r) => r.stock === 0).length,
      units: rows.reduce((s, r) => s + r.stock, 0),
    }),
    [rows],
  );

  function draftFor(r: VariantStockRow) {
    return drafts[r.variantId] ?? r.stock;
  }
  function setDraft(id: string, v: number) {
    setDrafts((d) => ({ ...d, [id]: Math.max(0, Math.round(v || 0)) }));
    setSaved((s) => ({ ...s, [id]: false }));
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

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `Tudo (${counts.all})` },
    { id: "low", label: `Acabando (${counts.low})` },
    { id: "out", label: `Esgotado (${counts.out})` },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center rounded-full border border-border bg-surface px-3 sm:max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto ou SKU"
            className="h-10 w-full bg-transparent px-2 text-sm outline-none"
          />
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
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
        <span className="text-xs text-muted sm:ml-auto">
          {counts.units} unidades no total
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Nada aqui.</p>
        )}
        {filtered.map((r, i) => {
          const header = i === 0 || filtered[i - 1].productName !== r.productName;
          const d = draftFor(r);
          const dirty = d !== r.stock;
          return (
            <div key={r.variantId}>
              {header && (
                <div className="flex items-center justify-between border-t border-border bg-black/[0.015] px-4 pb-1 pt-3 first:border-t-0">
                  <Link
                    href={`/admin/produtos/${r.productId}`}
                    className="text-sm font-bold hover:text-primary"
                  >
                    {r.productName}
                  </Link>
                  {!r.productActive && (
                    <span className="text-[11px] font-semibold text-danger">inativo</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.sku && <p className="text-[11px] text-muted">{r.sku}</p>}
                </div>

                <span
                  className={cn(
                    "hidden w-16 text-right text-xs sm:block",
                    r.stock === 0
                      ? "text-danger"
                      : r.stock <= LOW
                        ? "text-warning"
                        : "text-muted",
                  )}
                >
                  {r.stock} atual
                </span>

                <div className="flex items-center rounded-lg border border-border">
                  <button
                    onClick={() => setDraft(r.variantId, d - 1)}
                    className="p-2 text-muted hover:text-foreground"
                    aria-label="Diminuir"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    value={d}
                    onChange={(e) => setDraft(r.variantId, Number(e.target.value))}
                    inputMode="numeric"
                    className="w-12 border-x border-border py-1.5 text-center text-sm font-semibold outline-none"
                  />
                  <button
                    onClick={() => setDraft(r.variantId, d + 1)}
                    className="p-2 text-muted hover:text-foreground"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button
                  size="sm"
                  variant={dirty ? "primary" : "ghost"}
                  disabled={!dirty || saving[r.variantId]}
                  onClick={() => save(r)}
                  className="w-20 shrink-0"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
