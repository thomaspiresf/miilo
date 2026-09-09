import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { imageUrl } from "@/lib/data/catalog";
import { getOrderById } from "@/lib/data/orders";
import type { Review } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING = /relation .* does not exist|could not find the table|schema cache/i;
const PAID = ["paid", "shipped", "delivered"];

export type ReviewableProduct = {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  variantLabels: string[];
  review: { rating: number; comment: string | null; photos: string[] } | null;
};

/**
 * Lista os produtos de um pedido que o cliente pode avaliar + o que ele já
 * avaliou. Retorna null se o pedido não é do `userId` ou não foi pago.
 */
export async function getReviewableProducts(
  orderId: string,
  userId: string,
): Promise<ReviewableProduct[] | null> {
  if (!hasSupabaseAdmin()) return null;
  const order = await getOrderById(orderId);
  if (!order || order.user_id !== userId || !PAID.includes(order.status)) return null;

  const admin = createAdminClient();
  const variantIds = [...new Set(order.items.map((i) => i.variant_id).filter(Boolean))];
  if (variantIds.length === 0) return [];

  const { data: variants } = await admin
    .from("product_variants")
    .select("id, size, color, product:products(id, name, slug, images:product_images(storage_path, sort))")
    .in("id", variantIds);

  const { data: existing } = await admin
    .from("reviews")
    .select("product_id, rating, comment, photos")
    .eq("order_id", orderId);
  const reviewByProduct = new Map<string, any>(
    (existing ?? []).map((r: any) => [r.product_id, r]),
  );

  const byProduct = new Map<string, ReviewableProduct>();
  for (const item of order.items) {
    const v: any = (variants ?? []).find((x: any) => x.id === item.variant_id);
    const p = v?.product;
    if (!p) continue;
    let entry = byProduct.get(p.id);
    if (!entry) {
      const firstImg = (p.images ?? []).sort(
        (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0),
      )[0];
      const r = reviewByProduct.get(p.id);
      entry = {
        productId: p.id,
        name: p.name,
        slug: p.slug,
        imageUrl: firstImg ? imageUrl(firstImg.storage_path) : null,
        variantLabels: [],
        review: r
          ? {
              rating: r.rating,
              comment: r.comment ?? null,
              photos: (r.photos ?? []).map((x: string) => imageUrl(x)),
            }
          : null,
      };
      byProduct.set(p.id, entry);
    }
    if (item.variant_label && !entry.variantLabels.includes(item.variant_label)) {
      entry.variantLabels.push(item.variant_label);
    }
  }
  return [...byProduct.values()];
}

export type ReviewSubmission = {
  productId: string;
  rating: number;
  comment: string | null;
  photos: string[]; // paths no bucket
};

export async function submitReviews(
  orderId: string,
  userId: string,
  authorName: string | null,
  items: ReviewSubmission[],
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseAdmin()) return { ok: false, error: "Indisponível." };
  const order = await getOrderById(orderId);
  if (!order || order.user_id !== userId || !PAID.includes(order.status)) {
    return { ok: false, error: "Pedido não encontrado." };
  }

  const admin = createAdminClient();
  // só aceita produtos que realmente estão no pedido
  const allowed = await getReviewableProducts(orderId, userId);
  const allowedIds = new Set((allowed ?? []).map((p) => p.productId));

  const rows = items
    .filter((i) => allowedIds.has(i.productId) && i.rating >= 1 && i.rating <= 5)
    .map((i) => ({
      product_id: i.productId,
      order_id: orderId,
      user_id: userId,
      author_name: authorName,
      rating: i.rating,
      comment: i.comment?.trim() || null,
      photos: (i.photos ?? []).slice(0, 6),
    }));

  if (rows.length === 0) return { ok: false, error: "Nada para enviar." };

  const { error } = await admin
    .from("reviews")
    .upsert(rows, { onConflict: "order_id,product_id" });
  if (error) {
    if (MISSING.test(error.message)) {
      return { ok: false, error: "Avaliações ainda não estão disponíveis." };
    }
    console.error("submitReviews", error.message);
    return { ok: false, error: "Não foi possível salvar." };
  }
  return { ok: true };
}

export async function listReviewsForProduct(
  productId: string,
  limit = 20,
): Promise<Review[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reviews")
    .select("id, product_id, author_name, rating, comment, photos, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    author_name: r.author_name ?? null,
    rating: r.rating,
    comment: r.comment ?? null,
    photos: (r.photos ?? []).map((x: string) => imageUrl(x)),
    created_at: r.created_at,
  }));
}

/** Há pedido(s) pagos do usuário com produtos ainda não avaliados? */
export async function hasPendingReviews(userId: string): Promise<boolean> {
  if (!hasSupabaseAdmin()) return false;
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .in("status", PAID);
  if (!orders?.length) return false;
  const { data: reviews } = await admin
    .from("reviews")
    .select("order_id")
    .in(
      "order_id",
      orders.map((o: any) => o.id),
    );
  const reviewed = new Set((reviews ?? []).map((r: any) => r.order_id));
  return orders.some((o: any) => !reviewed.has(o.id));
}
