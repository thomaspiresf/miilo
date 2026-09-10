import type { PricingSettings } from "@/lib/types";

/**
 * Conta de precificação — funções puras, sem banco.
 * Usada no servidor (lib/data/pricing.ts) e no navegador (pricing-client.tsx),
 * pra as duas telas mostrarem exatamente os mesmos números.
 */

/** Arredonda pra cima terminando em ,90 (padrão da loja). */
export function niceUp(n: number): number {
  if (n <= 0) return 0;
  const base = Math.ceil(n);
  return base - 0.1 < n ? base + 0.9 : base - 0.1;
}

/**
 * Fração do PREÇO que evapora em taxa de pagamento + imposto.
 * Usa a taxa de crédito (pior caso comum).
 */
export function priceDrain(s: PricingSettings): number {
  return (s.mpCreditPercent + s.taxPercent) / 100;
}

/**
 * Custo variável por unidade que NÃO depende do preço (só a embalagem por
 * enquanto — "outros custos variáveis" entram aqui quando existirem).
 */
export function fixedVariablePerUnit(s: PricingSettings): number {
  return s.packagingCost;
}

/** Custo fixo mensal rateado por pedido (0 se não há estimativa de pedidos/mês). */
export function fixedPerOrder(s: PricingSettings): number {
  const monthly = s.fixedCosts.reduce((a, f) => a + (f.amount || 0), 0);
  return s.monthlyOrders > 0 ? monthly / s.monthlyOrders : 0;
}

export type Margins = {
  cost: number | null;
  price: number;
  /** custo variável total por unidade (produto + embalagem + taxa + imposto) */
  variableCost: number | null;

  /** partes da conta, pra mostrar o detalhamento */
  packaging: number;
  feePct: number;
  taxPct: number;
  feeValue: number | null;
  taxValue: number | null;
  fixedShare: number;

  /** BRUTA — só o produto: (preço − custo) ÷ preço */
  grossValue: number | null;
  grossPct: number | null;

  /** CONTRIBUIÇÃO — produto + embalagem + taxa + imposto */
  contribValue: number | null;
  contribPct: number | null;

  /** LÍQUIDA — contribuição menos custo fixo rateado por pedido.
   *  null enquanto não houver estimativa de pedidos/mês. */
  netValue: number | null;
  netPct: number | null;

  /** preço ÷ custo (fator multiplicador — NÃO é margem) */
  markup: number | null;
  /** menor preço que ainda dá contribuição zero (abaixo disso = prejuízo) */
  minPrice: number | null;
};

export function computeMargins(
  cost: number | null,
  price: number,
  s: PricingSettings,
  /** custo fixo mensal ÷ pedidos/mês. 0 = não calcula a líquida. */
  fixedShare = 0,
): Margins {
  const feePct = s.mpCreditPercent;
  const taxPct = s.taxPercent;
  const drain = priceDrain(s);
  const pv = fixedVariablePerUnit(s);

  if (cost == null || !(price > 0)) {
    return {
      cost,
      price,
      variableCost: null,
      packaging: pv,
      feePct,
      taxPct,
      feeValue: null,
      taxValue: null,
      fixedShare,
      grossValue: null,
      grossPct: null,
      contribValue: null,
      contribPct: null,
      netValue: null,
      netPct: null,
      markup: null,
      minPrice: null,
    };
  }

  const feeValue = price * (feePct / 100);
  const taxValue = price * (taxPct / 100);
  const variableCost = cost + pv + feeValue + taxValue;
  const grossValue = price - cost;
  const contribValue = price - variableCost;
  const netValue = fixedShare > 0 ? contribValue - fixedShare : null;

  return {
    cost,
    price,
    variableCost,
    packaging: pv,
    feePct,
    taxPct,
    feeValue,
    taxValue,
    fixedShare,
    grossValue,
    grossPct: (grossValue / price) * 100,
    contribValue,
    contribPct: (contribValue / price) * 100,
    netValue,
    netPct: netValue != null ? (netValue / price) * 100 : null,
    markup: cost > 0 ? price / cost : null,
    minPrice: drain < 1 ? (cost + pv) / (1 - drain) : null,
  };
}

/**
 * Preço de venda pra sobrar `targetPct`% de MARGEM DE CONTRIBUIÇÃO
 * (depois de produto + embalagem + taxa + imposto). Arredondado pra ,90.
 */
export function suggestForContribution(
  cost: number,
  s: PricingSettings,
  targetPct: number,
): number | null {
  const drain = priceDrain(s);
  const pv = fixedVariablePerUnit(s);
  const tm = targetPct / 100;
  return drain + tm < 1 ? niceUp((cost + pv) / (1 - drain - tm)) : null;
}
