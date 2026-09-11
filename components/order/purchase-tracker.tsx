"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics";

export type PurchaseTrackerOrder = {
  id: string;
  number: string;
  total: number;
  items: { variantId: string; name: string; unitPrice: number; qty: number }[];
};

/**
 * Dispara o evento "purchase" (GA4/Meta) quando o pedido confirma como pago.
 * Guardado em localStorage por id de pedido — evita contar de novo se o
 * cliente atualizar ou voltar pra essa página depois.
 */
export function PurchaseTracker({ order }: { order: PurchaseTrackerOrder }) {
  useEffect(() => {
    const key = `miilo_purchase_tracked_${order.id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      trackPurchase({
        id: order.id,
        number: order.number,
        total: order.total,
        items: order.items.map((it) => ({
          id: it.variantId,
          name: it.name,
          price: it.unitPrice,
          quantity: it.qty,
        })),
      });
      window.localStorage.setItem(key, "1");
    } catch {
      /* localStorage indisponível (modo privado etc.) — não é crítico */
    }
  }, [order]);

  return null;
}
