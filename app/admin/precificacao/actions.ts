"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  savePricingSettings,
  setProductCostPrice,
  getPricingSettings,
} from "@/lib/data/pricing";
import { adminGetProduct } from "@/lib/data/admin";
import { logAction } from "@/lib/data/audit";
import { formatBRL } from "@/lib/format";

const pct = z.coerce.number().min(0).max(100);
const money = z.coerce.number().min(0).max(10_000_000);

const settingsSchema = z.object({
  taxPercent: pct,
  mpCreditPercent: pct,
  mpPixPercent: pct,
  mpDebitPercent: pct,
  packagingCost: money,
  freeShippingThreshold: z.union([money, z.null()]),
  freeShippingStoreShare: pct,
  targetMarginPercent: pct,
  fixedCosts: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        amount: money,
      }),
    )
    .max(30),
});

export async function savePricingSettingsAction(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await savePricingSettings(parsed.data);
    await logAction({
      action: "settings.pricing",
      entity: "settings",
      summary: `Atualizou as regras de precificação (imposto ${parsed.data.taxPercent}%, margem-alvo ${parsed.data.targetMarginPercent}%, custo fixo ${formatBRL(
        parsed.data.fixedCosts.reduce((s, f) => s + f.amount, 0),
      )}/mês)`,
    });
  } catch (err) {
    console.error("savePricingSettings", err);
    return { error: "Não foi possível salvar." };
  }
  revalidatePath("/admin/precificacao");
  return { ok: true };
}

const cpSchema = z.object({
  productId: z.string().uuid(),
  cost: z.union([money, z.null()]).optional(),
  price: money.optional(),
});

export async function setProductPricingAction(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const parsed = cpSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" };
  const { productId, cost, price } = parsed.data;

  const before = await adminGetProduct(productId);
  try {
    await setProductCostPrice(productId, {
      ...(cost !== undefined ? { cost } : {}),
      ...(price !== undefined ? { price } : {}),
    });
  } catch (err) {
    console.error("setProductPricing", err);
    return { error: "Não foi possível salvar." };
  }

  const parts: string[] = [];
  if (cost !== undefined) {
    const old = before?.variants.find((v) => v.cost != null)?.cost ?? null;
    parts.push(
      `custo ${old != null ? formatBRL(old) : "—"} → ${cost != null ? formatBRL(cost) : "—"}`,
    );
  }
  if (price !== undefined) {
    parts.push(`preço ${formatBRL(before?.price_from ?? 0)} → ${formatBRL(price)}`);
  }
  await logAction({
    action: cost !== undefined && price === undefined ? "product.cost" : "product.price",
    entity: "product",
    entityId: productId,
    summary: `Precificação de "${before?.name ?? productId}": ${parts.join(" · ")}`,
  });

  revalidatePath("/admin/precificacao");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  return { ok: true };
}

export async function getPricingSettingsAction() {
  await requireAdmin();
  return getPricingSettings();
}
