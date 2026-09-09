import "server-only";
import { unstable_cache } from "next/cache";
import { env, paymentsMocked } from "@/lib/env";

export type Installment = {
  /** número máximo de parcelas que o MP oferece para esse valor */
  count: number;
  /** valor de cada parcela (já com os juros do MP) */
  amount: number;
  /** total pago no fim (valor + juros) */
  total: number;
};

async function fetchMax(amount: number): Promise<Installment | null> {
  if (paymentsMocked() || !env.mercadopago.accessToken || amount <= 0) return null;
  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payment_methods/installments?amount=${amount.toFixed(
        2,
      )}&payment_method_id=master`,
      { headers: { Authorization: `Bearer ${env.mercadopago.accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      payer_costs?: Array<{
        installments: number;
        installment_amount: number;
        total_amount: number;
      }>;
    }>;
    const pc = data?.[0]?.payer_costs;
    if (!Array.isArray(pc) || pc.length === 0) return null;
    const last = pc[pc.length - 1];
    return {
      count: last.installments,
      amount: last.installment_amount,
      total: last.total_amount,
    };
  } catch {
    return null;
  }
}

/** Parcelamento máximo do Mercado Pago para um valor, com cache de 12h. */
export function getMaxInstallment(amount: number) {
  const key = amount.toFixed(2);
  return unstable_cache(() => fetchMax(amount), ["mp-installment", key], {
    revalidate: 60 * 60 * 12,
  })();
}

/** Mapa preço -> parcelamento, para os preços passados (dedup + em paralelo). */
export async function getInstallmentsForPrices(
  prices: number[],
): Promise<Record<string, Installment>> {
  const unique = [...new Set(prices.filter((p) => p > 0))];
  const out: Record<string, Installment> = {};
  await Promise.all(
    unique.map(async (p) => {
      const inst = await getMaxInstallment(p);
      if (inst) out[String(p)] = inst;
    }),
  );
  return out;
}
