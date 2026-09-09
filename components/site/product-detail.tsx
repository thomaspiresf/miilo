"use client";

import { useState, type ReactNode } from "react";
import type { Product, ProductImage } from "@/lib/types";
import type { Installment } from "@/lib/mp-installments";
import { ProductGallery } from "@/components/site/product-gallery";
import { ProductBuyBox } from "@/components/site/product-buy-box";

/** Fotos a mostrar para a cor escolhida (com fallback para as fotos "de todas"). */
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

export function ProductDetail({
  product,
  info,
  installments,
}: {
  product: Product;
  info: ReactNode;
  installments: Record<string, Installment>;
}) {
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [color, setColor] = useState<string | null>(first?.color ?? null);

  const gallery = imagesForColor(product.images, color);
  // remonta a galeria só quando o conjunto de fotos realmente muda
  const galleryKey = gallery.map((im) => im.id).join(",");

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ProductGallery
        key={galleryKey}
        images={gallery}
        name={product.name}
        video={product.video_url}
      />
      <div>
        {info}
        <div className="mt-6">
          <ProductBuyBox
            product={product}
            color={color}
            onColorChange={setColor}
            installments={installments}
          />
        </div>
      </div>
    </div>
  );
}
