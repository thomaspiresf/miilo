import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";

/* eslint-disable @typescript-eslint/no-explicit-any */

const mem: { productId: string; variantId: string | null; email: string; createdAt: string }[] = [];

export async function createStockAlert(input: {
  productId: string;
  variantId: string | null;
  email: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();

  if (!hasSupabaseAdmin()) {
    if (!mem.some((a) => a.productId === input.productId && a.variantId === input.variantId && a.email === email)) {
      mem.push({ productId: input.productId, variantId: input.variantId, email, createdAt: new Date().toISOString() });
    }
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("stock_alerts").insert({
    product_id: input.productId,
    variant_id: input.variantId,
    email,
  });
  // 23505 = já está na lista -> tudo certo, não é erro pro usuário
  if (error && (error as any).code !== "23505") throw error;
}

export type StockAlertRow = {
  email: string;
  variantLabel: string | null;
  createdAt: string;
};

/** Lista de espera pendente de um produto (visão do admin). */
export async function listStockAlerts(productId: string): Promise<StockAlertRow[]> {
  if (!hasSupabaseAdmin()) {
    return mem
      .filter((a) => a.productId === productId)
      .map((a) => ({ email: a.email, variantLabel: null, createdAt: a.createdAt }));
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("stock_alerts")
    .select("email, created_at, variant:product_variants(size, color)")
    .eq("product_id", productId)
    .is("notified_at", null)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r: any) => ({
    email: r.email,
    variantLabel: r.variant
      ? [r.variant.size, r.variant.color].filter(Boolean).join(" · ") || null
      : null,
    createdAt: r.created_at,
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
