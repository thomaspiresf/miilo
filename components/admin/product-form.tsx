"use client";

import { useActionState, useMemo, useState } from "react";
import { saveProductAction } from "@/app/admin/actions";
import { isSimpleKind, type Category, type Product } from "@/lib/types";
import { parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { VariantEditor } from "@/components/admin/variant-editor";

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

type AgeUnit = "meses" | "anos";

export function ProductForm({
  product,
  categories,
}: {
  product: Product | null;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, null);

  const [categoryId, setCategoryId] = useState(product?.category.id ?? "");
  const kind = useMemo(
    () => categories.find((c) => c.id === categoryId)?.kind ?? null,
    [categories, categoryId],
  );
  // brinquedo/livro: campos Material+Medidas, sem tamanho/cor, idade em anos.
  const isGoods = isSimpleKind(kind);
  // se o produto já tiver 2+ variações (raro), mantém a grade pra não perder dados.
  const goodsSimple = isGoods && (product?.variants.length ?? 0) <= 1;

  // faixa etária — guardada em meses no banco, editável em meses ou anos.
  // só mostra em "anos" quando os valores são múltiplos exatos de 12 (sem perder precisão).
  const yearish = (v: number | null | undefined) => v == null || (v >= 12 && v % 12 === 0);
  const initialUnit: AgeUnit =
    (product?.age_min_months || product?.age_max_months) &&
    yearish(product?.age_min_months) &&
    yearish(product?.age_max_months)
      ? "anos"
      : "meses";
  const toDisplay = (m: number | null | undefined) => {
    if (m == null) return "";
    return initialUnit === "anos" ? String(Math.round(m / 12)) : String(m);
  };
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(initialUnit);
  const [ageMin, setAgeMin] = useState(toDisplay(product?.age_min_months));
  const [ageMax, setAgeMax] = useState(toDisplay(product?.age_max_months));

  function switchAgeUnit(next: AgeUnit) {
    if (next === ageUnit) return;
    const conv = (v: string) => {
      if (v.trim() === "") return "";
      const n = Number(v);
      if (!Number.isFinite(n)) return "";
      return next === "anos" ? String(Math.max(0, Math.round(n / 12))) : String(n * 12);
    };
    setAgeMin(conv(ageMin));
    setAgeMax(conv(ageMax));
    setAgeUnit(next);
  }

  const factor = ageUnit === "anos" ? 12 : 1;
  const toMonths = (v: string) =>
    v.trim() === "" || !Number.isFinite(Number(v))
      ? ""
      : String(Math.round(Number(v) * factor));

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

  // brinquedo/livro sem variação: 1 "variação" só, sem tamanho/cor.
  const simpleVariantsJson = JSON.stringify(
    rows.slice(0, 1).map((r) => ({
      id: r.id,
      size: null,
      color: null,
      colorHex: null,
      price: parseMoney(r.price) ?? 0,
      stock: parseInt(r.stock || "0", 10),
      weightGrams: parseInt(r.weightGrams || "300", 10),
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={product?.id ?? "novo"} />
      <input type="hidden" name="ageMinMonths" value={toMonths(ageMin)} />
      <input type="hidden" name="ageMaxMonths" value={toMonths(ageMax)} />

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
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
          <Field
            label="Preço antigo (riscado)"
            hint="Opcional — só se estiver em promoção. O preço de venda vai em cada variação."
          >
            <Input
              name="compareAtPrice"
              inputMode="decimal"
              defaultValue={product?.compare_at_price ?? ""}
              placeholder="119.90"
            />
          </Field>
        </div>

        {/* Faixa etária */}
        <Field label="Faixa etária" hint="Deixe vazio se serve para qualquer idade.">
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="mín."
              className="h-11 w-20 rounded-xl border border-border bg-surface px-3 text-sm"
            />
            <span className="text-muted">a</span>
            <input
              inputMode="numeric"
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="máx."
              className="h-11 w-20 rounded-xl border border-border bg-surface px-3 text-sm"
            />
            <div className="flex gap-1">
              {(["meses", "anos"] as AgeUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => switchAgeUnit(u)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    ageUnit === u
                      ? "bg-foreground text-background"
                      : "border border-border bg-surface hover:bg-black/5",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </Field>

        {/* Detalhes — variam por tipo de produto */}
        {isGoods ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Material"
              hint={
                kind === "livros"
                  ? "Ex.: capa dura, brochura, cartonado"
                  : "Ex.: Plástico ABS, madeira, pelúcia"
              }
            >
              <Input
                name="material"
                defaultValue={product?.material ?? ""}
                placeholder={kind === "livros" ? "Capa dura" : "Plástico ABS atóxico"}
              />
            </Field>
            <Field
              label="Medidas"
              hint={
                kind === "livros"
                  ? "Ex.: 20 × 20 cm, 32 páginas"
                  : "Ex.: 30 cm de altura, 20×15×10 cm"
              }
            >
              <Input
                name="dimensions"
                defaultValue={product?.dimensions ?? ""}
                placeholder={kind === "livros" ? "21 × 27 cm · 40 páginas" : "30 cm de altura"}
              />
            </Field>
          </div>
        ) : (
          <Field label="Composição">
            <Input
              name="composition"
              defaultValue={product?.composition ?? ""}
              placeholder="100% algodão"
            />
          </Field>
        )}

        {!isGoods && (
          <Field label="Modelagem (acordeão)">
            <textarea
              name="fitNotes"
              rows={2}
              defaultValue={product?.fit_notes ?? ""}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
        )}
        <Field label={isGoods ? "Cuidados / segurança (acordeão)" : "Cuidados (acordeão)"}>
          <textarea
            name="careNotes"
            rows={2}
            defaultValue={product?.care_notes ?? ""}
            placeholder={
              isGoods ? "Limpar com pano úmido. Não imergir em água." : undefined
            }
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

        {isGoods ? (
          <input type="hidden" name="splitByColor" value="on" />
        ) : (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="splitByColor"
              defaultChecked={product ? product.split_by_color : true}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-semibold">Mostrar cada cor separada na vitrine</span>
              <span className="block text-xs font-normal text-muted">
                Ligado: “Body Azul”, “Body Verde”… aparecem como produtos
                diferentes, cada um com sua foto. Desligado: um card só, com
                todas as cores dentro.
              </span>
            </span>
          </label>
        )}
      </div>

      {goodsSimple ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <input type="hidden" name="variants" value={simpleVariantsJson} />
          <Label>Preço e estoque</Label>
          <p className="mb-3 mt-1 text-xs text-muted">
            {kind === "livros" ? "Livro" : "Brinquedo"} não tem tamanho nem cor —
            é só o preço, o estoque e o peso.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Preço R$">
              <Input
                inputMode="decimal"
                value={rows[0].price}
                onChange={(e) => updateRow(0, { price: e.target.value })}
                placeholder="59.90"
              />
            </Field>
            <Field label="Estoque">
              <Input
                inputMode="numeric"
                value={rows[0].stock}
                onChange={(e) => updateRow(0, { stock: e.target.value })}
              />
            </Field>
            <Field label="Peso com caixa (g)" hint="para o frete">
              <Input
                inputMode="numeric"
                value={rows[0].weightGrams}
                onChange={(e) => updateRow(0, { weightGrams: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : (
        <VariantEditor product={product} />
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Spinner /> : product ? "Salvar alterações" : "Criar produto"}
      </Button>
    </form>
  );
}
