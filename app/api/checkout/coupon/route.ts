import { NextResponse } from "next/server";
import { z } from "zod";
import { validateCoupon } from "@/lib/data/coupons";
import { resolveSubtotal } from "@/lib/data/orders";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";

const schema = z.object({
  code: z.string().min(1).max(40),
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1),
});

/** Valida um cupom contra o carrinho (preview). A conta final é refeita em /checkout/create. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`coupon:${clientIp(request)}`, 40, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  }

  let subtotal: number;
  try {
    subtotal = await resolveSubtotal(parsed.data.lines);
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível validar o cupom agora." }, { status: 422 });
  }

  const result = await validateCoupon(parsed.data.code, subtotal);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error });
  }
  return NextResponse.json({
    ok: true,
    code: result.code,
    percentOff: result.percentOff,
    discount: result.discount,
  });
}
