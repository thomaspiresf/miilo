import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminSetVariantStock } from "@/lib/data/admin";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

const schema = z.object({
  variantId: z.string().min(1),
  stock: z.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`admin-stock:${clientIp(request)}`, 60, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);
  await requireAdmin();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const stock = await adminSetVariantStock(
      parsed.data.variantId,
      parsed.data.stock,
      parsed.data.note ?? null,
    );
    return NextResponse.json({ ok: true, stock });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao salvar" },
      { status: 422 },
    );
  }
}
