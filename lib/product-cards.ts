import type { Product, ProductImage } from "@/lib/types";

/** Fotos a mostrar para uma cor (com fallback para as fotos "de todas"). */
export function imagesForColor(images: ProductImage[], color: string | null) {
  if (color) {
    const tagged = images.filter(
      (im) => im.color && im.color.toLowerCase() === color.toLowerCase(),
    );
    if (tagged.length) return tagged;
  }
  const untagged = images.filter((im) => !im.color);
  return untagged.length ? untagged : images;
}

/** Cores distintas de um produto, na ordem em que aparecem nas variações. */
export function productColors(product: Product): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of product.variants) {
    if (v.color && !seen.has(v.color.toLowerCase())) {
      seen.add(v.color.toLowerCase());
      out.push(v.color);
    }
  }
  return out;
}

/** Um card da vitrine: um produto, opcionalmente recortado numa cor. */
export type ProductCardItem = {
  key: string;
  product: Product;
  color: string | null;
  colorLabel: string | null;
  href: string;
  image: ProductImage | null;
  priceFrom: number;
  compareAtFrom: number | null;
  inStock: boolean;
};

function cardForColor(product: Product, color: string | null, showLabel: boolean): ProductCardItem {
  const variants = color
    ? product.variants.filter((v) => v.color === color)
    : product.variants;
  const prices = variants.map((v) => v.price).filter((p) => p > 0);
  const priceFrom = prices.length ? Math.min(...prices) : product.price_from;
  const inStock = color
    ? variants.some((v) => v.stock > 0)
    : product.in_stock;

  return {
    key: color ? `${product.id}:${color}` : product.id,
    product,
    color,
    colorLabel: showLabel ? color : null,
    href: color ? `/p/${product.slug}?cor=${encodeURIComponent(color)}` : `/p/${product.slug}`,
    image: imagesForColor(product.images, color)[0] ?? null,
    priceFrom,
    compareAtFrom: product.compare_at_from,
    inStock,
  };
}

/** Um card por produto (sem separar por cor) — usado em "você também pode gostar". */
export function toCardItem(product: Product): ProductCardItem {
  return cardForColor(product, null, false);
}

/**
 * Explode a lista em um card por COR (roupa com várias cores aparece separada
 * na vitrine, cada uma com as fotos daquela cor). Produto sem cor / com uma
 * cor só vira um card normal. Mantém a ordem dos produtos; cores na ordem das
 * variações.
 */
export function explodeByColor(products: Product[]): ProductCardItem[] {
  return products.flatMap((p) => {
    const colors = productColors(p);
    if (colors.length <= 1 || p.split_by_color === false) {
      // um card só (produto sem cor, ou marcado pra "mostrar tudo junto")
      return [cardForColor(p, null, false)];
    }
    return colors.map((c) => cardForColor(p, c, true));
  });
}
