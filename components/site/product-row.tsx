"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardItem } from "@/lib/product-cards";
import { ProductCard } from "@/components/site/product-card";
import { cn } from "@/lib/utils";

export function ProductRow({ items }: { items: ProductCardItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function update() {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    update();
  }, [items]);

  function scroll(dir: 1 | -1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrowBase =
    "absolute top-[28%] z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-black/[0.04] sm:flex";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:gap-4 sm:px-0"
      >
        {items.map((it) => (
          <div key={it.key} className="w-[44vw] shrink-0 snap-start sm:w-52">
            <ProductCard item={it} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Anterior"
        className={cn(arrowBase, "-left-4", atStart && "sm:hidden")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Próximo"
        className={cn(arrowBase, "-right-4", atEnd && "sm:hidden")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
