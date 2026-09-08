"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProductAction } from "@/app/admin/actions";
import type { Category, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

type VariantRow = {
  id?: string;
  size: string;
  color: string;
  colorHex: string;
  price: string;
  stock: string;
  weightGrams: string;
};

const emptyRow: VariantRow = {
  size: "",
  color: "",
  colorHex: "",
  price: "",
  stock: "0",
  weightGrams: "300",
};

export function ProductForm({
  product,
  categories,
}: {
  product: Product | null;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, null);

  const [rows, setRows] = useState<VariantRow[]>(
    product && product.variants.length
      ? product.variants.map((v) => ({
          id: v.id,
          size: v.size ?? "",
          color: v.color ?? "",
          colorHex: v.color_hex ?? "",
          price: String(v.price),
          stock: String(v.stock),
          weightGrams: String(v.weight_grams),
        }))
      : [{ ...emptyRow }],
  );

  function updateRow(i: number, patch: Partial<VariantRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  const variantsJson = JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      size: r.size.trim() || null,
      color: r.color.trim() || null,
      colorHex: r.colorHex.trim() || null,
      price: Number(r.price) || 0,
      stock: parseInt(r.stock || "0", 10),
      weightGrams: parseInt(r.weightGrams || "300", 10),
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={product?.id ?? "novo"} />
      <input type="hidden" name="variants" value={variantsJson} />

      {state?.error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>
      )}

      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5">
        <Field label="Nome">
          <Input name="name" required defaultValue={product?.name} />
        </Field>
        <Field label="Descrição">
          <textarea
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              name="categoryId"
              required
              defaultValue={product?.category.id ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marca">
            <Input name="brand" defaultValue={product?.brand ?? ""} />
          </Field>
          <Field label="Gênero">
            <select
              name="gender"
              defaultValue={product?.gender ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3"
            >
              <option value="">unissex / não informar</option>
              <option value="menino">menino</option>
              <option value="menina">menina</option>
              <option value="unissex">unissex</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Idade mín. (meses)">
              <Input
                name="ageMinMonths"
                type="number"
                min={0}
                defaultValue={product?.age_min_months ?? ""}
              />
            </Field>
            <Field label="Idade máx. (meses)">
              <Input
                name="ageMaxMonths"
                type="number"
                min={0}
                defaultValue={product?.age_max_months ?? ""}
              />
            </Field>
          </div>
          <Field label="Preço “de” (riscado)" hint="Deixe vazio se não há promoção.">
            <Input
              name="compareAtPrice"
              inputMode="decimal"
              defaultValue={product?.compare_at_price ?? ""}
              placeholder="119.90"
            />
          </Field>
          <Field label="Composição">
            <Input
              name="composition"
              defaultValue={product?.composition ?? ""}
              placeholder="100% algodão"
            />
          </Field>
        </div>
        <Field label="Modelagem (acordeão)">
          <textarea
            name="fitNotes"
            rows={2}
            defaultValue={product?.fit_notes ?? ""}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>
        <Field label="Cuidados (acordeão)">
          <textarea
            name="careNotes"
            rows={2}
            defaultValue={product?.care_notes ?? ""}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product ? product.active : true}
            className="accent-primary"
          />
          Produto ativo (visível na loja)
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <Label className="mb-0">Variações</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRows((r) => [...r, { ...emptyRow }])}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-6">
              <input
                placeholder="Tamanho"
                value={row.size}
                onChange={(e) => updateRow(i, { size: e.target.value })}
                className="h-10 rounded-lg border border-border px-2.5 text-sm"
              />
              <input
                placeholder="Cor"
                value={row.color}
                onChange={(e) => updateRow(i, { color: e.target.value })}
                className="h-10 rounded-lg border border-border px-2.5 text-sm"
              />
              <div className="flex items-center gap-1.5 rounded-lg border border-border px-2">
                <input
                  type="color"
                  value={row.colorHex || "#cccccc"}
                  onChange={(e) => updateRow(i, { colorHex: e.target.value })}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Cor do swatch"
                />
                <input
                  placeholder="#hex"
                  value={row.colorHex}
                  onChange={(e) => updateRow(i, { colorHex: e.target.value })}
                  className="h-9 w-full min-w-0 text-sm outline-none"
                />
              </div>
              <input
                placeholder="Preço"
                inputMode="decimal"
                value={row.price}
                onChange={(e) => updateRow(i, { price: e.target.value })}
                className="h-10 rounded-lg border border-border px-2.5 text-sm"
              />
              <input
                placeholder="Estoque"
                inputMode="numeric"
                value={row.stock}
                onChange={(e) => updateRow(i, { stock: e.target.value })}
                className="h-10 rounded-lg border border-border px-2.5 text-sm"
              />
              <div className="flex items-center gap-1">
                <input
                  placeholder="Peso (g)"
                  inputMode="numeric"
                  value={row.weightGrams}
                  onChange={(e) => updateRow(i, { weightGrams: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border px-2.5 text-sm"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-muted hover:text-danger"
                    aria-label="Remover variação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Spinner /> : product ? "Salvar alterações" : "Criar produto"}
      </Button>
    </form>
  );
}
