import { NextResponse } from "next/server";
import { checkoutCreateSchema } from "@/lib/checkout-schema";
import { getUser } from "@/lib/auth";
import { createOrder, resolveLines } from "@/lib/data/orders";
import { validateCoupon } from "@/lib/data/coupons";
import { quoteShipping } from "@/lib/melhorenvio";
import { onlyDigits } from "@/lib/utils";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";
import { site } from "@/lib/site";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`checkout:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = checkoutCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const user = await getUser();

  // Preço/peso reais das variações — fonte da verdade pro cupom e pro frete
  let resolved;
  try {
    resolved = await resolveLines(parsed.data.lines);
  } catch (err) {
    console.error("checkout/create resolve error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Item indisponível" },
      { status: 422 },
    );
  }
  const subtotal =
    Math.round(
      (resolved.reduce((s, l) => s + l.unitPrice * l.qty, 0) + Number.EPSILON) * 100,
    ) / 100;

  // Cupom — revalida no servidor contra o subtotal real (nunca confia no cliente)
  let discount = 0;
  let couponCode: string | null = null;
  if (parsed.data.couponCode) {
    try {
      const check = await validateCoupon(parsed.data.couponCode, subtotal);
      if (!check.ok) {
        return NextResponse.json({ error: `Cupom: ${check.error}` }, { status: 422 });
      }
      discount = check.discount;
      couponCode = check.code;
    } catch (err) {
      console.error("checkout/create coupon error", err);
      return NextResponse.json({ error: "Não foi possível validar o cupom." }, { status: 422 });
    }
  }

  // Frete — re-cota no servidor. O cliente escolhe a transportadora, mas o
  // PREÇO vem sempre da cotação do servidor (nunca do corpo da requisição).
  let shipping = { company: "", service: "Retirada na loja", price: 0 };
  if (parsed.data.deliveryMode === "delivery") {
    const cep = onlyDigits(parsed.data.address?.cep ?? "");
    if (cep.length !== 8) {
      return NextResponse.json({ error: "CEP inválido" }, { status: 422 });
    }
    try {
      const options = await quoteShipping({
        toCep: cep,
        items: resolved.map((l) => ({
          qty: l.qty,
          weightGrams: l.weightGrams,
          unitPrice: l.unitPrice,
        })),
      });
      const want = parsed.data.shipping;
      const match =
        options.find(
          (o) => o.company === want.company && o.service === want.service,
        ) ?? [...options].sort((a, b) => a.price - b.price)[0];
      if (!match) {
        return NextResponse.json(
          { error: "Não foi possível confirmar o frete. Recalcule e tente de novo." },
          { status: 422 },
        );
      }
      shipping = { company: match.company, service: match.service, price: match.price };
    } catch (err) {
      console.error("checkout/create shipping error", err);
      return NextResponse.json(
        { error: "Não foi possível calcular o frete agora." },
        { status: 422 },
      );
    }
  }

  try {
    const order = await createOrder({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      userId: user?.id ?? null,
      deliveryMode: parsed.data.deliveryMode,
      address: parsed.data.address ?? null,
      shipping,
      lines: parsed.data.lines,
      discount,
      couponCode,
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.number,
      amount: order.total,
      publicKey: site.mpPublicKey,
    });
  } catch (err) {
    console.error("checkout/create error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao criar o pedido" },
      { status: 422 },
    );
  }
}
