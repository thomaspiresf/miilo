"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/lib/types";

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            const next = Math.min(existing.maxStock, existing.qty + qty);
            return {
              lines: state.lines.map((l) =>
                l.variantId === line.variantId ? { ...l, qty: next } : l,
              ),
            };
          }
          return {
            lines: [...state.lines, { ...line, qty: Math.min(line.maxStock, qty) }],
          };
        }),
      setQty: (variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.variantId === variantId
                ? { ...l, qty: Math.max(0, Math.min(l.maxStock, qty)) }
                : l,
            )
            .filter((l) => l.qty > 0),
        })),
      remove: (variantId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.variantId !== variantId),
        })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    }),
    { name: "miilo-cart" },
  ),
);
