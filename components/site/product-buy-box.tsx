"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ShoppingBag, Zap } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/types";
import { useCart } from "@/lib/cart-store";
import { discountPercent, formatBRL, installmentText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SizeGuide } from "@/components/site/size-guide";
import { CepEstimate } from "@/components/checkout/cep-estimate";

function variantLabel(v: ProductVariant) {
  return [v.size, v.color].filter(Boolean).join(" · ") || "Único";
}

export function ProductBuyBox({
  product,
  color,
  onColorChange,
}: {
  product: Product;
  color: string | null;
  onColorChange: (c: string | null) => void;
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

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [added, setAdded] = useState(false);

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

  function sizeStock(s: string) {
    return variants
      .filter((v) => v.size === s && (colors.length === 0 || v.color === color))
      .reduce((n, v) => n + v.stock, 0);
  }
  function colorStock(c: string) {
    return variants
      .filter((v) => v.color === c && (sizes.length === 0 || v.size === size))
      .reduce((n, v) => n + v.stock, 0);
  }

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
    if (!addSelected()) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    if (!addSelected()) return;
    router.push("/checkout");
  }

  const price = selected?.price ?? product.price_from;
  const compareAt =
    selected && product.compare_at_price && product.compare_at_price > price
      ? product.compare_at_price
      : product.compare_at_from;
  const off = discountPercent(price, compareAt);
  const installments = installmentText(price, product.max_installments);
  const outOfStock = !selected || selected.stock < 1;

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
        {installments && <p className="text-sm text-muted">{installments}</p>}
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
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((c) => {
              const avail = colorStock(c.name) > 0;
              return (
                <button
                  key={c.name}
                  onClick={() => onColorChange(c.name)}
                  title={c.name}
                  aria-label={c.name}
                  className={cn(
                    "relative h-9 w-9 rounded-full border-2 transition",
                    color === c.name ? "border-foreground" : "border-border",
                    !avail && "opacity-40",
                  )}
                  style={{ backgroundColor: c.hex ?? "#d4d4d8" }}
                >
                  {!avail && (
                    <span className="absolute inset-0 m-auto h-px w-8 rotate-45 bg-foreground/60" />
                  )}
                </button>
              );
            })}
            <span className="text-sm text-muted">
              Ver cores ({colors.length})
            </span>
          </div>
        </div>
      )}

      {/* tamanho */}
      {sizes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Tamanho</p>
            <SizeGuide />
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const stock = sizeStock(s);
              const oos = stock === 0;
              return (
                <button
                  key={s}
                  onClick={() => !oos && setSize(s)}
                  disabled={oos}
                  className={cn(
                    "relative min-w-11 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                    size === s && !oos
                      ? "border-foreground"
                      : "border-border bg-surface",
                    oos && "text-muted",
                  )}
                >
                  <span className={cn(oos && "line-through")}>{s}</span>
                  {oos && (
                    <Bell className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-background text-muted" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        {outOfStock
          ? "Combinação indisponível — escolha outro tamanho ou cor."
          : selected && selected.stock <= 5
            ? `Últimas ${selected.stock} unidades`
            : "Pronta entrega"}
      </p>

      {/* CTA — barra fixa no mobile */}
      <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border bg-background/95 p-4 pb-safe backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button onClick={handleBuyNow} size="lg" className="w-full" disabled={outOfStock}>
          <Zap className="h-5 w-5" /> Comprar agora
        </Button>
        <Button
          onClick={handleAdd}
          size="lg"
          variant="outline"
          className="w-full"
          disabled={outOfStock}
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
      </div>

      <div className="border-t border-border pt-5">
        <CepEstimate
          weightGrams={selected?.weight_grams ?? 300}
          price={price}
        />
      </div>
    </div>
  );
}
