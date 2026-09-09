import { NextResponse } from "next/server";
import { checkoutCreateSchema } from "@/lib/checkout-schema";
import { getUser } from "@/lib/auth";
import { createOrder, resolveSubtotal } from "@/lib/data/orders";
import { validateCoupon } from "@/lib/data/coupons";
import { site } from "@/lib/site";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const user = await getUser();

  // Cupom — revalida no servidor contra o subtotal real (nunca confia no cliente)
  let discount = 0;
  let couponCode: string | null = null;
  if (parsed.data.couponCode) {
    try {
      const subtotal = await resolveSubtotal(parsed.data.lines);
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

  try {
    const order = await createOrder({
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      userId: user?.id ?? null,
      deliveryMode: parsed.data.deliveryMode,
      address: parsed.data.address ?? null,
      shipping: parsed.data.shipping,
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
