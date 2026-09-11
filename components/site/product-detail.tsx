"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/types";
import type { Installment } from "@/lib/mp-installments";
import { imagesForColor } from "@/lib/product-cards";
import { ProductGallery } from "@/components/site/product-gallery";
import { ProductBuyBox } from "@/components/site/product-buy-box";
import { trackViewItem } from "@/lib/analytics";

type Props = {
  product: Product;
  info: ReactNode;
  installments: Record<string, Installment>;
};

export function ProductDetail(props: Props) {
  const { id, name, price_from } = props.product;
  // Fica aqui (fora do Suspense) pra disparar só uma vez por produto — o
  // fallback e o conteúdo real do Suspense abaixo trocam de instância do
  // ProductDetailInner, o que dispararia o evento em dobro se estivesse lá.
  useEffect(() => {
    trackViewItem({ id, name, price: price_from, quantity: 1 });
  }, [id, name, price_from]);

  // A página é estática/ISR. O `?cor=` vindo da vitrine é lido só no cliente
  // (Suspense) — o fallback já renderiza o produto inteiro na cor padrão, então
  // não há tela vazia nem perda de SEO/LCP.
  return (
    <Suspense fallback={<ProductDetailInner {...props} initialColor={null} />}>
      <ProductDetailWithColorParam {...props} />
    </Suspense>
  );
}

function ProductDetailWithColorParam(props: Props) {
  const raw = useSearchParams().get("cor");
  const initialColor = raw
    ? (props.product.variants.find(
        (v) => v.color && v.color.toLowerCase() === raw.toLowerCase(),
      )?.color ?? null)
    : null;
  return <ProductDetailInner {...props} initialColor={initialColor} />;
}

function ProductDetailInner({
  product,
  info,
  installments,
  initialColor,
}: Props & { initialColor: string | null }) {
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
