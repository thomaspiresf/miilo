"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createStockAlert } from "@/lib/data/stock-alerts";
import { rateLimit } from "@/lib/rate-limit";

const idLike = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i);
const inputSchema = z.object({
  productId: idLike,
  variantId: idLike.nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(160),
});

export async function subscribeStockAlertAction(input: {
  productId: string;
  variantId: string | null;
  email: string;
}): Promise<{ ok: true } | { error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`stockalert:${ip}`, 10, 60 * 60_000); // 10 por hora
  if (!rl.ok) return { error: "Muitas solicitações. Tente de novo mais tarde." };

  try {
    await createStockAlert({
      productId: parsed.data.productId,
      variantId: parsed.data.variantId ?? null,
      email: parsed.data.email,
    });
    return { ok: true };
  } catch (err) {
    console.error("subscribeStockAlert", err);
    return { error: "Não foi possível cadastrar agora. Tente de novo." };
  }
}
