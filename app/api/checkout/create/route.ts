import { NextResponse } from "next/server";
import { checkoutCreateSchema } from "@/lib/checkout-schema";
import { getUser } from "@/lib/auth";
import { createOrder } from "@/lib/data/orders";
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
