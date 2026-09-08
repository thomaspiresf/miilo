"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-square w-full rounded-2xl bg-black/5" />;
  }
  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/5">
        <Image
          src={images[active].url}
          alt={images[active].alt ?? name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 520px"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2",
                i === active ? "border-primary" : "border-transparent",
              )}
            >
              <Image src={im.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
