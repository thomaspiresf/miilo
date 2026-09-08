"use client";

import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";

export function CartCount() {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const hydrated = useHydrated();

  if (!hydrated || count === 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
