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
      userId: user?.id ?? null,
      address: parsed.data.address,
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
