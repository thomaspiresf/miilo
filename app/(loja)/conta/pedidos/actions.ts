"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { submitReviews, type ReviewSubmission } from "@/lib/data/reviews";

const schema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional().nullable(),
        photos: z.array(z.string().max(300)).max(6).optional().default([]),
      }),
    )
    .min(1),
});

export async function submitReviewAction(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  const user = await getUser();
  if (!user) return { error: "Faça login para avaliar." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const items: ReviewSubmission[] = parsed.data.items.map((i) => ({
    productId: i.productId,
    rating: i.rating,
    comment: i.comment ?? null,
    photos: i.photos ?? [],
  }));

  const res = await submitReviews(parsed.data.orderId, user.id, user.name, items);
  if (!res.ok) return { error: res.error ?? "Não foi possível salvar." };

  revalidatePath("/conta/pedidos");
  revalidatePath("/");
  return { ok: true };
}
