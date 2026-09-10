"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ShoppingBag, Zap } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/types";
import type { Installment } from "@/lib/mp-installments";
import { useCart } from "@/lib/cart-store";
import { discountPercent, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SizeGuide } from "@/components/site/size-guide";
import { StockAlertForm } from "@/components/site/stock-alert-form";
import { CepEstimate } from "@/components/checkout/cep-estimate";

function variantLabel(v: ProductVariant) {
  return [v.size, v.color].filter(Boolean).join(" · ") || "Único";
}

export function ProductBuyBox({
  product,
  color,
  onColorChange,
  installments,
}: {
  product: Product;
  color: string | null;
  onColorChange: (c: string | null) => void;
  installments: Record<string, Installment>;
}) {
  const router = useRouter();
  const variants = product.variants;
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[],
    [variants],
  );
  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of variants) if (v.color && !map.has(v.color)) map.set(v.color, v.color_hex);
    return [...map.entries()].map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  // Só pré-seleciona tamanho quando há um único. Com vários, o cliente escolhe —
  // assim as cores aparecem todas e só filtram DEPOIS que um tamanho é escolhido.
  const [size, setSize] = useState<string | null>(() => (sizes.length === 1 ? sizes[0] : null));
  const [added, setAdded] = useState(false);
  const [hint, setHint] = useState(false);

  const selected = useMemo(
    () =>
      variants.find(
        (v) =>
          (colors.length === 0 || v.color === color) &&
          (sizes.length === 0 || v.size === size),
      ) ?? null,
    [variants, color, size, colors.length, sizes.length],
  );

  const add = useCart((s) => s.add);

  // estoque de um tamanho dentro da cor selecionada
  function sizeStock(s: string) {
    return variants
      .filter((v) => v.size === s && (colors.length === 0 || v.color === color))
      .reduce((n, v) => n + v.stock, 0);
  }
  // estoque de uma cor — só filtra por tamanho depois que o cliente escolhe um
  function colorStock(c: string) {
    return variants
      .filter((v) => v.color === c && (size == null || v.size === size))
      .reduce((n, v) => n + v.stock, 0);
  }

  const needsSize = sizes.length > 0 && size == null;

  function addSelected() {
    if (!selected || selected.stock < 1) return false;
    add({
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(selected),
      unitPrice: selected.price,
      imageUrl: product.images[0]?.url ?? null,
      maxStock: selected.stock,
      weightGrams: selected.weight_grams,
    });
    return true;
  }

  function handleAdd() {
    if (needsSize) return setHint(true);
    if (!addSelected()) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    if (needsSize) return setHint(true);
    if (!addSelected()) return;
    router.push("/checkout");
  }

  const price = selected?.price ?? product.price_from;
  const compareAt =
    selected && product.compare_at_price && product.compare_at_price > price
      ? product.compare_at_price
      : product.compare_at_from;
  const off = discountPercent(price, compareAt);
  const inst = installments[String(price)];
  const soldOut = !needsSize && (!selected || selected.stock < 1);

  return (
    <div className="space-y-5">
      {/* preço */}
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-black">{formatBRL(price)}</span>
          {compareAt != null && off != null && (
            <>
              <span className="text-sm text-muted line-through">{formatBRL(compareAt)}</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                {off}% OFF
              </span>
            </>
          )}
        </div>
        {inst && inst.count > 1 && (
          <p className="text-sm text-muted">
            em até {inst.count}x de {formatBRL(inst.amount)}
          </p>
        )}
      </div>

      {/* cor */}
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm">
            <span className="font-semibold">Cor:</span>{" "}
            <span className="text-muted">
              {color}
              {selected?.sku ? ` | ${selected.sku}` : ""}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {colors.map((c) => {
              const avail = colorStock(c.name) > 0;
              const active = color === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onColorChange(c.name)}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={active}
                  className={cn(
                    "relative h-10 w-10 rounded-full border transition",
                    active
                      ? "border-transparent ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-black/15 hover:border-black/40",
                    !avail && "opacity-40",
                  )}
                  style={{ backgroundColor: c.hex ?? "#d4d4d8" }}
                >
                  {!avail && (
                    <span className="absolute inset-0 m-auto h-px w-9 rotate-45 bg-foreground/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* tamanho */}
      {sizes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">Tamanho:</span>{" "}
              <span className={cn(size ? "text-muted" : "font-semibold text-primary")}>
                {size ?? "escolha abaixo"}
              </span>
            </p>
            <SizeGuide />
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const oos = sizeStock(s) === 0;
              const active = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSize(s);
                    setHint(false);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "relative min-w-[3rem] rounded-lg border-2 px-4 py-2 text-center text-sm font-bold transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : oos
                        ? "border-border bg-surface text-muted"
                        : "border-foreground/40 bg-surface text-foreground hover:border-foreground hover:bg-black/[0.03]",
                  )}
                >
                  <span className={cn(oos && "line-through")}>{s}</span>
                  {oos && (
                    <Bell className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-background p-0.5 text-muted" />
                  )}
                </button>
              );
            })}
          </div>
          {hint && needsSize && (
            <p className="mt-2 text-sm font-semibold text-primary">
              Escolha um tamanho pra continuar.
            </p>
          )}
        </div>
      )}

      {!soldOut && !needsSize && (
        <p className="text-xs text-muted">
          {selected && selected.stock <= 5
            ? `Últimas ${selected.stock} unidades`
            : "Pronta entrega"}
        </p>
      )}

      {soldOut ? (
        <StockAlertForm
          productId={product.id}
          variantId={selected?.id ?? null}
          variantLabel={
            selected && (sizes.length > 0 || colors.length > 0)
              ? variantLabel(selected)
              : null
          }
        />
      ) : (
        /* CTA — barra fixa no mobile */
        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border bg-background/95 p-4 pb-safe backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            onClick={handleBuyNow}
            size="lg"
            className={cn("w-full", needsSize && "opacity-60")}
          >
            <Zap className="h-5 w-5" /> Comprar agora
          </Button>
          <Button
            onClick={handleAdd}
            size="lg"
            variant="outline"
            className={cn("w-full", needsSize && "opacity-60")}
          >
            {added ? (
              <>
                <Check className="h-5 w-5" /> Na sacola
              </>
            ) : (
              <>
                <ShoppingBag className="h-5 w-5" /> Adicionar à sacola
              </>
            )}
          </Button>
          {needsSize && (
            <p className="text-center text-xs text-muted">Selecione o tamanho acima</p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-5">
        <CepEstimate
          weightGrams={selected?.weight_grams ?? 300}
          price={price}
        />
      </div>
    </div>
  );
}
