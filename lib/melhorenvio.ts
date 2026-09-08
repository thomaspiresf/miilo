import "server-only";
import { env, shippingMocked } from "@/lib/env";
import { onlyDigits } from "@/lib/utils";
import type { ShippingOption } from "@/lib/types";

export type QuoteRequest = {
  toCep: string;
  items: { qty: number; weightGrams: number; unitPrice: number }[];
};

const SANDBOX_BASE = "https://sandbox.melhorenvio.com.br";
const PROD_BASE = "https://melhorenvio.com.br";

/**
 * Tabela de frete fixa usada no modo demonstração (ou sem token do Melhor Envio).
 * Aproximação por região a partir do primeiro dígito do CEP.
 */
function mockQuote(req: QuoteRequest): ShippingOption[] {
  const region = Number(onlyDigits(req.toCep)[0] ?? "5");
  const totalWeightKg = Math.max(
    0.3,
    req.items.reduce((s, i) => s + (i.weightGrams * i.qty) / 1000, 0),
  );
  const far = region <= 2 ? 0 : region <= 4 ? 8 : 16; // SP/RJ perto, Sul/CO/NE mais longe
  const base = 14.9 + totalWeightKg * 4.5 + far;
  const subtotal = req.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const options: ShippingOption[] = [
    {
      id: "mock-pac",
      company: "Correios",
      service: "PAC",
      price: round2(base),
      delivery_days: 4 + Math.round(far / 4),
    },
    {
      id: "mock-sedex",
      company: "Correios",
      service: "SEDEX",
      price: round2(base * 1.7),
      delivery_days: 2 + Math.round(far / 8),
    },
  ];

  // frete grátis acima de R$ 299 no PAC
  if (subtotal >= 299) options[0] = { ...options[0], price: 0, service: "PAC (grátis)" };
  return options;
}

export async function quoteShipping(req: QuoteRequest): Promise<ShippingOption[]> {
  if (shippingMocked()) return mockQuote(req);

  const base = env.melhorEnvio.sandbox ? SANDBOX_BASE : PROD_BASE;
  const products = req.items.map((i, idx) => ({
    id: String(idx),
    width: 15,
    height: 10,
    length: 20,
    weight: Math.max(0.1, (i.weightGrams * i.qty) / 1000),
    insurance_value: i.unitPrice * i.qty,
    quantity: i.qty,
  }));

  const res = await fetch(`${base}/api/v2/me/shipping/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.melhorEnvio.token}`,
      "User-Agent": `${env.site.storeName} (${env.site.url})`,
    },
    body: JSON.stringify({
      from: { postal_code: env.melhorEnvio.originCep },
      to: { postal_code: onlyDigits(req.toCep) },
      products,
    }),
  });

  if (!res.ok) {
    // fallback seguro: não trava o checkout
    return mockQuote(req);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const data: any[] = await res.json();
  return data
    .filter((s) => !s.error && (s.price || s.custom_price))
    .map((s) => ({
      id: String(s.id),
      company: s.company?.name ?? "Transportadora",
      service: s.name,
      price: round2(Number(s.custom_price ?? s.price)),
      delivery_days: Number(s.custom_delivery_time ?? s.delivery_time ?? 0),
    }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
