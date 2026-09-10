import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { adminListProducts } from "@/lib/data/admin";
import { listAllOrders } from "@/lib/data/orders";
import { imagesForColor } from "@/lib/product-cards";
import {
  computeMargins,
  fixedPerOrder,
  suggestForContribution,
  type Margins,
} from "@/lib/pricing-math";
import type { FixedCost, Order, PricingSettings, Product } from "@/lib/types";

/**
 * Uma venda "de verdade" pra contar como vendido: pedidos pagos + as vendas
 * na loja anotadas como "a receber" (o produto já saiu, o pagamento é que
 * está pendente). Pedido online pendente = carrinho abandonado, não conta.
 */
const isSold = (o: Order) =>
  ["paid", "shipped", "delivered"].includes(o.status) ||
  (o.channel === "pos" && o.status === "pending");

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING = /relation .* does not exist|could not find the table|schema cache|column .* does not exist/i;

export const DEFAULT_PRICING: PricingSettings = {
  taxPercent: 4,
  mpCreditPercent: 4.99,
  mpPixPercent: 0.99,
  mpDebitPercent: 3.79,
  packagingCost: 0,
  freeShippingThreshold: null,
  freeShippingStoreShare: 100,
  targetMarginPercent: 45,
  fixedCosts: [],
  monthlyOrders: 0,
};

function mapSettings(row: any): PricingSettings {
  return {
    taxPercent: Number(row.tax_percent ?? 4),
    mpCreditPercent: Number(row.mp_credit_percent ?? 4.99),
    mpPixPercent: Number(row.mp_pix_percent ?? 0.99),
    mpDebitPercent: Number(row.mp_debit_percent ?? 3.79),
    packagingCost: Number(row.packaging_cost ?? 0),
    freeShippingThreshold:
      row.free_shipping_threshold != null ? Number(row.free_shipping_threshold) : null,
    freeShippingStoreShare: Number(row.free_shipping_store_share ?? 100),
    targetMarginPercent: Number(row.target_margin_percent ?? 45),
    fixedCosts: Array.isArray(row.fixed_costs)
      ? row.fixed_costs
          .map((f: any) => ({
            label: String(f?.label ?? "").slice(0, 80),
            amount: Number(f?.amount) || 0,
          }))
          .filter((f: FixedCost) => f.label)
      : [],
    monthlyOrders: Math.max(0, Math.round(Number(row.monthly_orders ?? 0)) || 0),
  };
}

export async function getPricingSettings(): Promise<PricingSettings> {
  if (!hasSupabaseAdmin()) return DEFAULT_PRICING;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_PRICING;
  return mapSettings(data);
}

export async function savePricingSettings(s: PricingSettings): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("pricing_settings")
    .update({
      tax_percent: s.taxPercent,
      mp_credit_percent: s.mpCreditPercent,
      mp_pix_percent: s.mpPixPercent,
      mp_debit_percent: s.mpDebitPercent,
      packaging_cost: s.packagingCost,
      free_shipping_threshold: s.freeShippingThreshold,
      free_shipping_store_share: s.freeShippingStoreShare,
      target_margin_percent: s.targetMarginPercent,
      fixed_costs: s.fixedCosts,
      monthly_orders: s.monthlyOrders,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error && !MISSING.test(error.message)) {
    // coluna monthly_orders ainda não existe -> tenta sem ela
    if (/monthly_orders/.test(error.message)) {
      const retry = await admin
        .from("pricing_settings")
        .update({
          tax_percent: s.taxPercent,
          mp_credit_percent: s.mpCreditPercent,
          mp_pix_percent: s.mpPixPercent,
          mp_debit_percent: s.mpDebitPercent,
          packaging_cost: s.packagingCost,
          free_shipping_threshold: s.freeShippingThreshold,
          free_shipping_store_share: s.freeShippingStoreShare,
          target_margin_percent: s.targetMarginPercent,
          fixed_costs: s.fixedCosts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (retry.error && !MISSING.test(retry.error.message)) throw retry.error;
      return;
    }
    throw error;
  }
}

/** Grava o custo (e opcionalmente o preço) de TODAS as variações de um produto. */
export async function setProductCostPrice(
  productId: string,
  patch: { cost?: number | null; price?: number },
): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  const admin = createAdminClient();
  const row: Record<string, unknown> = {};
  if ("cost" in patch) row.cost = patch.cost;
  if (patch.price != null) row.price = patch.price;
  if (Object.keys(row).length === 0) return;
  const { error } = await admin
    .from("product_variants")
    .update(row)
    .eq("product_id", productId);
  if (error) throw error;
  if (patch.price != null) {
    await admin.from("products").update({ base_price: patch.price }).eq("id", productId);
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// -------------------------------------------------------------------------
//  Linhas da tabela de precificação (por produto)
// -------------------------------------------------------------------------

export type PricingRow = {
  productId: string;
  name: string;
  slug: string;
  active: boolean;
  categoryName: string;
  imageUrl: string | null;
  cost: number | null;
  /** preço único, ou null se as variações têm preços diferentes */
  price: number | null;
  priceMin: number;
  priceMax: number;
  compareAt: number | null;
  margins: Margins | null;
  /** preço sugerido pra bater a margem-alvo (de contribuição) */
  suggested: number | null;
  unitsSold: number;
  /** receita paga real (Σ unit_price × qty dos pedidos pagos) */
  soldRevenue: number;
  profitToDate: number | null;
  /** ids das variações — pra somar vendas por período no panorama */
  variantIds: string[];
  /** unidades em estoque (soma das variações ativas) */
  stockUnits: number;
  /** valor em estoque a custo (Σ estoque × custo da variação) */
  stockCost: number;
};

export async function listPricingRows(): Promise<{
  rows: PricingRow[];
  settings: PricingSettings;
}> {
  const [products, settings] = await Promise.all([
    adminListProducts(),
    getPricingSettings(),
  ]);

  // vendas (pagas + a receber) -> unidades por produto (via variação)
  const orders = await listAllOrders();
  const sold = orders.filter(isSold);
  const soldByVariant = new Map<string, number>();
  const revByVariant = new Map<string, number>();
  for (const o of sold)
    for (const it of o.items)
      if (it.variant_id) {
        soldByVariant.set(it.variant_id, (soldByVariant.get(it.variant_id) ?? 0) + it.qty);
        revByVariant.set(
          it.variant_id,
          (revByVariant.get(it.variant_id) ?? 0) + it.unit_price * it.qty,
        );
      }

  const fixedShare = fixedPerOrder(settings);

  const rows: PricingRow[] = products.map((p: Product) => {
    const prices = p.variants.map((v) => v.price).filter((x) => x > 0);
    const priceMin = prices.length ? Math.min(...prices) : p.base_price;
    const priceMax = prices.length ? Math.max(...prices) : p.base_price;
    const singlePrice = priceMin === priceMax ? priceMin : null;
    const costs = p.variants.map((v) => v.cost).filter((x): x is number => x != null);
    const cost = costs.length ? Math.min(...costs) : null;

    const unitsSold = p.variants.reduce(
      (s, v) => s + (soldByVariant.get(v.id) ?? 0),
      0,
    );
    const soldRevenue = round2(
      p.variants.reduce((s, v) => s + (revByVariant.get(v.id) ?? 0), 0),
    );
    const stockUnits = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
    const stockCost = round2(
      p.variants.reduce(
        (s, v) => s + Math.max(0, v.stock) * (v.cost ?? cost ?? 0),
        0,
      ),
    );

    const margins = computeMargins(cost, singlePrice ?? priceMin, settings, fixedShare);
    const suggested =
      cost != null
        ? suggestForContribution(cost, settings, settings.targetMarginPercent)
        : null;
    const profitToDate =
      margins.contribValue != null ? round2(margins.contribValue * unitsSold) : null;

    return {
      productId: p.id,
      name: p.name,
      slug: p.slug,
      active: p.active,
      categoryName: p.category.name,
      imageUrl: imagesForColor(p.images, null)[0]?.url ?? p.images[0]?.url ?? null,
      cost,
      price: singlePrice,
      priceMin,
      priceMax,
      compareAt: p.compare_at_from ?? null,
      margins,
      suggested,
      unitsSold,
      soldRevenue,
      profitToDate,
      variantIds: p.variants.map((v) => v.id),
      stockUnits,
      stockCost,
    };
  });

  return { rows, settings };
}

// -------------------------------------------------------------------------
//  Panorama — estoque + contribuição por produto (pros gráficos)
// -------------------------------------------------------------------------

export type InsightProduct = {
  name: string;
  image: string | null;
  /** unidades que já entraram (vendidas + em estoque hoje) */
  total: number;
  unitsSold: number;
  stockUnits: number;
  /** receita paga real */
  revenue: number;
  /** contribuição acumulada (contribValue/un × vendidos) */
  contrib: number;
  /** valor em estoque a custo */
  stockCost: number;
  /** já tem custo de compra cadastrado? */
  hasCost: boolean;
};

export type PricingInsights = {
  stockCost: number; // R$ parados em estoque (a custo)
  stockRetail: number; // se vender tudo pelo preço atual
  stockContribPotential: number; // contribuição se vender todo o estoque
  stockUnits: number;
  noCostStock: number; // qtd de produtos com estoque e sem custo cadastrado
  idleCount: number; // produtos com estoque e zero vendas no período
  products: InsightProduct[]; // tudo que vendeu (no período) ou tem estoque
};

/** `days` = janela a partir de hoje; `from`/`to` = intervalo (yyyy-mm-dd) e têm prioridade; nada = desde sempre. */
export type InsightRange = { days?: number; from?: string; to?: string };

export async function getPricingInsights(
  rows: PricingRow[],
  range: InsightRange = {},
): Promise<PricingInsights> {
  const orders = await listAllOrders();
  const sold = orders.filter(isSold);

  let fromT = -Infinity;
  let toT = Infinity;
  if (range.from || range.to) {
    if (range.from) fromT = Date.parse(`${range.from}T00:00:00`);
    if (range.to) toT = Date.parse(`${range.to}T23:59:59.999`);
  } else if (range.days && range.days > 0) {
    fromT = Date.now() - range.days * 86_400_000;
  }

  const soldByVariant = new Map<string, number>();
  const revByVariant = new Map<string, number>();
  for (const o of sold) {
    const t = Date.parse(o.created_at);
    if (Number.isFinite(t) && (t < fromT || t > toT)) continue;
    for (const it of o.items)
      if (it.variant_id) {
        soldByVariant.set(
          it.variant_id,
          (soldByVariant.get(it.variant_id) ?? 0) + it.qty,
        );
        revByVariant.set(
          it.variant_id,
          (revByVariant.get(it.variant_id) ?? 0) + it.unit_price * it.qty,
        );
      }
  }

  const active = rows.filter((r) => r.active);

  const stockCost = round2(active.reduce((s, r) => s + r.stockCost, 0));
  const stockRetail = round2(
    active.reduce((s, r) => s + r.stockUnits * r.priceMin, 0),
  );
  const stockContribPotential = round2(
    active.reduce((s, r) => s + r.stockUnits * (r.margins?.contribValue ?? 0), 0),
  );
  const stockUnits = active.reduce((s, r) => s + r.stockUnits, 0);
  const noCostStock = active.filter(
    (r) => r.stockUnits > 0 && r.cost == null,
  ).length;

  const products: InsightProduct[] = active
    .map((r) => {
      const unitsSold = r.variantIds.reduce(
        (s, id) => s + (soldByVariant.get(id) ?? 0),
        0,
      );
      const revenue = round2(
        r.variantIds.reduce((s, id) => s + (revByVariant.get(id) ?? 0), 0),
      );
      const contribUnit = r.margins?.contribValue ?? 0;
      return {
        name: r.name,
        image: r.imageUrl,
        total: unitsSold + r.stockUnits,
        unitsSold,
        stockUnits: r.stockUnits,
        revenue,
        contrib: round2(contribUnit * unitsSold),
        stockCost: r.stockCost,
        hasCost: r.cost != null,
      };
    })
    .filter((p) => p.unitsSold > 0 || p.stockUnits > 0);

  const idleCount = products.filter(
    (p) => p.stockUnits > 0 && p.unitsSold === 0,
  ).length;

  return {
    stockCost,
    stockRetail,
    stockContribPotential,
    stockUnits,
    noCostStock,
    idleCount,
    products,
  };
}

// -------------------------------------------------------------------------
//  Saúde do negócio
// -------------------------------------------------------------------------

export type BusinessHealth = {
  monthlyFixed: number;
  contributionMargin: number; // últimos `days` dias
  realProfit: number;
  avgMarginPct: number | null;
  breakEven: number | null; // R$/mês de venda pra cobrir os fixos
  periodDays: number;
  missingCost: number; // vendas sem custo cadastrado (não entram no lucro)
};

export async function getBusinessHealth(
  range: { days?: number; from?: string; to?: string } | number = 30,
): Promise<BusinessHealth> {
  const opts = typeof range === "number" ? { days: range } : range;
  const settings = await getPricingSettings();
  const monthlyFixed = settings.fixedCosts.reduce((s, f) => s + f.amount, 0);

  const products = await adminListProducts();
  const costByVariant = new Map<string, number | null>();
  const priceByVariant = new Map<string, number>();
  for (const p of products)
    for (const v of p.variants) {
      costByVariant.set(v.id, v.cost);
      priceByVariant.set(v.id, v.price);
    }

  let fromT = -Infinity;
  let toT = Infinity;
  if (opts.from || opts.to) {
    if (opts.from) fromT = Date.parse(`${opts.from}T00:00:00`);
    if (opts.to) toT = Date.parse(`${opts.to}T23:59:59.999`);
  } else if (opts.days && opts.days > 0) {
    fromT = Date.now() - opts.days * 86_400_000;
  }

  const allSold = (await listAllOrders()).filter(isSold);
  const orders = allSold.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return Number.isFinite(t) ? t >= fromT && t <= toT : true;
  });

  // dias do período (pra ratear o custo fixo): janela fixa, intervalo, ou
  // "desde sempre" = do pedido mais antigo até hoje
  let days: number;
  if (opts.from && opts.to) {
    days = Math.max(1, Math.round((toT - fromT) / 86_400_000));
  } else if (opts.days && opts.days > 0) {
    days = opts.days;
  } else {
    const oldest = allSold.reduce(
      (min, o) => Math.min(min, new Date(o.created_at).getTime() || min),
      Date.now(),
    );
    days = Math.max(30, Math.round((Date.now() - oldest) / 86_400_000));
  }

  const drain = (settings.mpCreditPercent + settings.taxPercent) / 100;
  let contribution = 0;
  let revenueWithCost = 0;
  let missingCost = 0;
  for (const o of orders) {
    let orderContrib = 0;
    let orderRevenue = 0;
    let costed = false;
    for (const it of o.items) {
      const cost = it.variant_id ? costByVariant.get(it.variant_id) : null;
      const line = it.unit_price * it.qty;
      if (cost == null) {
        missingCost += line;
        continue;
      }
      costed = true;
      orderContrib += (it.unit_price - cost - it.unit_price * drain) * it.qty;
      orderRevenue += line;
    }
    if (!costed) continue;
    // embalagem: uma vez por PEDIDO, não por unidade
    orderContrib -= settings.packagingCost;
    // cupom: sai do bolso da loja — rateia pra parte com custo cadastrado
    if (o.discount > 0) {
      const hit = o.discount * Math.min(1, orderRevenue / (o.subtotal || orderRevenue));
      orderContrib -= hit;
      orderRevenue -= hit;
    }
    contribution += orderContrib;
    revenueWithCost += orderRevenue;
  }

  const fixedForPeriod = (monthlyFixed / 30) * days;
  const avgMarginPct =
    revenueWithCost > 0 ? round2((contribution / revenueWithCost) * 100) : null;
  const breakEven =
    avgMarginPct && avgMarginPct > 0 ? round2(monthlyFixed / (avgMarginPct / 100)) : null;

  return {
    monthlyFixed: round2(monthlyFixed),
    contributionMargin: round2(contribution),
    realProfit: round2(contribution - fixedForPeriod),
    avgMarginPct,
    breakEven,
    periodDays: days,
    missingCost: round2(missingCost),
  };
}
