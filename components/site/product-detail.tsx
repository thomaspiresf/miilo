"use client";

import { useState, type ReactNode } from "react";
import type { Product } from "@/lib/types";
import type { Installment } from "@/lib/mp-installments";
import { imagesForColor } from "@/lib/product-cards";
import { ProductGallery } from "@/components/site/product-gallery";
import { ProductBuyBox } from "@/components/site/product-buy-box";

export function ProductDetail({
  product,
  info,
  installments,
  initialColor = null,
}: {
  product: Product;
  info: ReactNode;
  installments: Record<string, Installment>;
  initialColor?: string | null;
}) {
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [color, setColor] = useState<string | null>(initialColor ?? first?.color ?? null);

  const gallery = imagesForColor(product.images, color);
  // remonta a galeria só quando o conjunto de fotos realmente muda
  const galleryKey = gallery.map((im) => im.id).join(",");

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <ProductGallery
        key={galleryKey}
        images={gallery}
        name={product.name}
        video={product.video_url}
        videoAudio={product.video_audio}
      />
      <div>
        {info}
        <div className="mt-6">
          <ProductBuyBox
            key={color ?? "default"}
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
