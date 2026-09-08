import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { discountPercent, formatBRL } from "@/lib/format";
import { Rating } from "@/components/site/rating";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0]?.url;
  const compareAt = product.compare_at_from;
  const off = discountPercent(product.price_from, compareAt);

  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black/[0.04]">
        {image && (
          <Image
            src={image}
            alt={product.images[0]?.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        )}
        {off != null && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            {off}% OFF
          </span>
        )}
        {!product.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
              Esgotado
            </span>
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="line-clamp-2 text-sm leading-snug text-foreground/80">
          {product.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          {compareAt != null && (
            <span className="text-xs text-muted line-through">
              {formatBRL(compareAt)}
            </span>
          )}
          <span className="text-sm font-black">{formatBRL(product.price_from)}</span>
        </div>
        {product.rating_count > 0 && (
          <div className="mt-1">
            <Rating avg={product.rating_avg} count={product.rating_count} showEmpty={false} />
          </div>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
