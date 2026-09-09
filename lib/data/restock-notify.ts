import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { listPendingAlertsForProduct, markAlertsNotified } from "@/lib/data/stock-alerts";
import { sendRestockEmail } from "@/lib/email";

/* eslint-disable @typescript-eslint/no-explicit-any */

type VariantInfo = { id: string; stock: number; label: string | null };
type ProductInfo = { name: string; slug: string; variants: VariantInfo[] };

function variantLabel(size: string | null, color: string | null) {
  return [size, color].filter(Boolean).join(" · ") || null;
}

async function loadProduct(productId: string): Promise<ProductInfo | null> {
  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === productId);
    if (!p) return null;
    return {
      name: p.name,
      slug: p.slug,
      variants: p.variants.map((v) => ({
        id: v.id,
        stock: v.stock,
        label: variantLabel(v.size, v.color),
      })),
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("name, slug, variants:product_variants(id, stock, size, color)")
    .eq("id", productId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: (data as any).name,
    slug: (data as any).slug,
    variants: ((data as any).variants ?? []).map((v: any) => ({
      id: v.id,
      stock: Number(v.stock ?? 0),
      label: variantLabel(v.size ?? null, v.color ?? null),
    })),
  };
}

/**
 * Avisa quem está na lista de espera de um produto quando o estoque volta.
 * Idempotente: cada inscrição é marcada como avisada e não dispara de novo.
 * Chamado depois de qualquer alteração de estoque no admin. Nunca lança.
 */
export async function notifyRestockForProduct(productId: string): Promise<void> {
  try {
    const alerts = await listPendingAlertsForProduct(productId);
    if (alerts.length === 0) return;

    const product = await loadProduct(productId);
    if (!product) return;

    const anyInStock = product.variants.some((v) => v.stock > 0);
    const notified: string[] = [];

    for (const alert of alerts) {
      const variant = alert.variantId
        ? product.variants.find((v) => v.id === alert.variantId)
        : null;
      const inStock = alert.variantId ? (variant?.stock ?? 0) > 0 : anyInStock;
      if (!inStock) continue;

      const ok = await sendRestockEmail({
        to: alert.email,
        productName: product.name,
        productSlug: product.slug,
        variantLabel: variant?.label ?? null,
      });
      // marca como avisada mesmo se o envio estiver desligado (modo demo),
      // pra não acumular pendências antigas — só não marca em falha real de rede
      if (ok || !process.env.RESEND_API_KEY) notified.push(alert.id);
    }

    await markAlertsNotified(notified);
  } catch (err) {
    console.error("notifyRestockForProduct", err);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
