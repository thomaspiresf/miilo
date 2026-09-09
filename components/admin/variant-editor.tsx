"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import type { Product } from "@/lib/types";

type SizeRow = { id?: string; size: string; stock: string };
type ColorGroup = { color: string; colorHex: string; sizes: SizeRow[] };

const COMMON_SIZES = ["RN", "P", "M", "G", "GG"];

function fromProduct(product: Product | null): {
  price: string;
  weight: string;
  groups: ColorGroup[];
} {
  if (!product || product.variants.length === 0) {
    return {
      price: "",
      weight: "300",
      groups: [{ color: "", colorHex: "", sizes: [{ size: "", stock: "0" }] }],
    };
  }
  // menor preço ENTRE OS NÃO-ZERADOS (evita que uma variação com preço 0
  // zere o produto todo). Se todas forem 0, deixa vazio pra forçar o preenchimento.
  const nonZero = product.variants.map((v) => v.price).filter((p) => p > 0);
  const price = nonZero.length ? String(Math.min(...nonZero)) : "";
  const weight = String(product.variants[0].weight_grams || 300);

  const map = new Map<string, ColorGroup>();
  for (const v of product.variants) {
    const key = (v.color ?? "").toLowerCase();
    if (!map.has(key)) {
      map.set(key, { color: v.color ?? "", colorHex: v.color_hex ?? "", sizes: [] });
    }
    map.get(key)!.sizes.push({ id: v.id, size: v.size ?? "", stock: String(v.stock) });
  }
  return { price, weight, groups: [...map.values()] };
}

/**
 * Editor de variações de roupa: um preço/peso pro produto, e por cor você
 * marca quais tamanhos existem e o estoque de cada um.
 * Emite um <input type="hidden" name="variants"> com a lista achatada (cor × tamanho).
 */
export function VariantEditor({ product }: { product: Product | null }) {
  const [init] = useState(() => fromProduct(product));
  const [price, setPrice] = useState(init.price);
  const [weight, setWeight] = useState(init.weight);
  const [groups, setGroups] = useState<ColorGroup[]>(init.groups);

  function patchGroup(gi: number, patch: Partial<ColorGroup>) {
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function patchSize(gi: number, si: number, patch: Partial<SizeRow>) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, sizes: g.sizes.map((s, j) => (j === si ? { ...s, ...patch } : s)) }
          : g,
      ),
    );
  }
  function addSize(gi: number, size: string) {
    const name = size.trim();
    setGroups((gs) =>
      gs.map((g, i) => {
        if (i !== gi) return g;
        if (name && g.sizes.some((s) => s.size.toLowerCase() === name.toLowerCase())) return g;
        return { ...g, sizes: [...g.sizes, { size: name, stock: "0" }] };
      }),
    );
  }
  function removeSize(gi: number, si: number) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, sizes: g.sizes.filter((_, j) => j !== si) } : g,
      ),
    );
  }
  function addColor() {
    setGroups((gs) => [...gs, { color: "", colorHex: "", sizes: [{ size: "", stock: "0" }] }]);
  }
  function removeColor(gi: number) {
    setGroups((gs) => gs.filter((_, i) => i !== gi));
  }

  const unitPrice = parseMoney(price) ?? 0;
  const unitWeight = parseInt(weight || "300", 10) || 300;

  // achata cor × tamanho -> lista de variações
  const flat = groups.flatMap((g) => {
    const rows = g.sizes.length ? g.sizes : [{ size: "", stock: "0" } as SizeRow];
    return rows.map((s) => ({
      id: s.id,
      size: s.size.trim() || null,
      color: g.color.trim() || null,
      colorHex: g.colorHex.trim() || null,
      price: unitPrice,
      stock: parseInt(s.stock || "0", 10) || 0,
      weightGrams: unitWeight,
    }));
  });

  const totalStock = flat.reduce((n, v) => n + v.stock, 0);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <input type="hidden" name="variants" value={JSON.stringify(flat.length ? flat : [])} />

      <div>
        <Label className="mb-0">Preço, peso e estoque</Label>
        <p className="mt-1 text-xs text-muted">
          O preço vale para todos os tamanhos e cores. Em cada cor você marca os
          tamanhos que existem e quantas peças tem de cada.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Preço R$"
          error={unitPrice <= 0 ? "Defina um preço maior que zero." : undefined}
        >
          <Input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="59.90"
          />
        </Field>
        <Field label="Peso com caixa (g)" hint="usado no cálculo do frete">
          <Input
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
      </div>

      <div className="space-y-3">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={g.colorHex || "#cccccc"}
                onChange={(e) => patchGroup(gi, { colorHex: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Cor do swatch"
              />
              <input
                value={g.color}
                onChange={(e) => patchGroup(gi, { color: e.target.value })}
                placeholder={groups.length > 1 ? "Cor (ex.: Verde)" : "Cor (opcional)"}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border px-2.5 text-sm"
              />
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColor(gi)}
                  className="p-1.5 text-muted hover:text-danger"
                  aria-label="Remover cor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {g.sizes.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <input
                    value={s.size}
                    onChange={(e) => patchSize(gi, si, { size: e.target.value })}
                    placeholder="Tamanho (P, M, G, Único…)"
                    className="h-9 w-40 rounded-lg border border-border px-2.5 text-sm"
                  />
                  <input
                    inputMode="numeric"
                    value={s.stock}
                    onChange={(e) =>
                      patchSize(gi, si, { stock: e.target.value.replace(/[^\d]/g, "") })
                    }
                    placeholder="qtd"
                    className="h-9 w-20 rounded-lg border border-border px-2.5 text-sm"
                  />
                  <span className="text-xs text-muted">em estoque</span>
                  {g.sizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSize(gi, si)}
                      className="ml-auto p-1 text-muted hover:text-danger"
                      aria-label="Remover tamanho"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {COMMON_SIZES.filter(
                  (sz) => !g.sizes.some((s) => s.size.toLowerCase() === sz.toLowerCase()),
                ).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => addSize(gi, sz)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-foreground/30 hover:text-foreground"
                  >
                    + {sz}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addSize(gi, "")}
                  className={cn(
                    "rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted",
                    "hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  + outro
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={addColor}>
          <Plus className="h-4 w-4" /> Adicionar cor
        </Button>
        <span className="text-xs text-muted">
          {flat.length} variaç{flat.length === 1 ? "ão" : "ões"} · {totalStock} peças
        </span>
      </div>
    </div>
  );
}
