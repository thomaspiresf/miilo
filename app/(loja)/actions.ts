"use server";

import { createStockAlert } from "@/lib/data/stock-alerts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeStockAlertAction(input: {
  productId: string;
  variantId: string | null;
  email: string;
}): Promise<{ ok: true } | { error: string }> {
  const email = String(input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) return { error: "E-mail inválido" };
  if (!input.productId) return { error: "Produto inválido" };

  try {
    await createStockAlert({
      productId: input.productId,
      variantId: input.variantId || null,
      email,
    });
    return { ok: true };
  } catch (err) {
    console.error("subscribeStockAlert", err);
    return { error: "Não foi possível cadastrar agora. Tente de novo." };
  }
}
