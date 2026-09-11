"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/lib/site";

/**
 * Analytics de e-commerce (Google Analytics 4 + Meta Pixel).
 *
 * Nada é enviado sem consentimento (banner de cookies — LGPD): os eventos
 * abaixo só saem de fato quando `hasConsent()` é true, e os scripts do GA/Meta
 * só são carregados depois disso (ver `components/site/analytics-scripts.tsx`).
 * Sem `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_META_PIXEL_ID` no
 * `.env.local`, tudo aqui vira no-op.
 */

const CONSENT_KEY = "miilo_analytics_consent";
const CONSENT_EVENT = "miilo:consent-change";

export type ConsentState = "accepted" | "declined" | null;

function readConsent(): ConsentState {
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_EVENT, callback);
  };
}

/** `null` até a decisão ser lida do localStorage (evita descompasso de hidratação). */
export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, readConsent, () => null);
}

export function setConsent(value: "accepted" | "declined") {
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

function hasConsent() {
  return typeof window !== "undefined" && readConsent() === "accepted";
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

export type AnalyticsItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

function gaItems(items: AnalyticsItem[]) {
  return items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    price: i.price,
    quantity: i.quantity,
  }));
}

function metaContents(items: AnalyticsItem[]) {
  return items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price }));
}

/**
 * Empilha direto no `dataLayer` — igual ao que o gtag.js faz por baixo dos
 * panos (`function gtag(){dataLayer.push(arguments)}`). Não usamos o
 * `sendGAEvent` do `@next/third-parties`: ele só funciona depois que o
 * componente `<GoogleAnalytics>` renderizou pelo menos uma vez (checa uma
 * variável de módulo interna), o que corre risco de perder o primeiro evento
 * disparado no mesmo carregamento de página (ex.: `view_item` da página de
 * produto, cujo efeito roda antes do consentimento habilitar o componente).
 * Como o `dataLayer` é só uma fila, empilhar aqui funciona mesmo antes do
 * gtag.js carregar — ele processa a fila assim que sobe.
 */
function fireGA(name: string, params: Record<string, unknown>) {
  if (!hasConsent() || !site.gaId) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(["event", name, params]);
}

function fireMeta(name: string, params: Record<string, unknown>) {
  if (!hasConsent() || !site.metaPixelId || !window.fbq) return;
  window.fbq("track", name, params);
}

/** Cliente abriu a página de um produto. */
export function trackViewItem(item: AnalyticsItem) {
  fireGA("view_item", {
    currency: "BRL",
    value: item.price,
    items: gaItems([item]),
  });
  fireMeta("ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency: "BRL",
  });
}

/** Adicionou (ou comprou direto) um item na sacola. */
export function trackAddToCart(item: AnalyticsItem) {
  const value = item.price * item.quantity;
  fireGA("add_to_cart", { currency: "BRL", value, items: gaItems([item]) });
  fireMeta("AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value,
    currency: "BRL",
  });
}

/** Chegou na tela de checkout com itens na sacola. */
export function trackBeginCheckout(items: AnalyticsItem[]) {
  const value = items.reduce((s, i) => s + i.price * i.quantity, 0);
  fireGA("begin_checkout", { currency: "BRL", value, items: gaItems(items) });
  fireMeta("InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    contents: metaContents(items),
    value,
    currency: "BRL",
    num_items: items.reduce((s, i) => s + i.quantity, 0),
  });
}

/** Pedido confirmado como pago. */
export function trackPurchase(order: {
  id: string;
  number: string;
  total: number;
  items: AnalyticsItem[];
}) {
  fireGA("purchase", {
    transaction_id: order.number,
    currency: "BRL",
    value: order.total,
    items: gaItems(order.items),
  });
  fireMeta("Purchase", {
    content_ids: order.items.map((i) => i.id),
    contents: metaContents(order.items),
    value: order.total,
    currency: "BRL",
  });
}
