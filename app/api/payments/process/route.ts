import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, approveOrder, setOrderStatus } from "@/lib/data/orders";
import { createPayment, type BrickFormData } from "@/lib/mercadopago";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";

const schema = z.object({
  orderId: z.string().min(1),
  formData: z.object({
    token: z.string().optional(),
    issuer_id: z.union([z.string(), z.number()]).optional(),
    payment_method_id: z.string(),
    installments: z.number().optional(),
    transaction_amount: z.number().optional(),
    payer: z
      .object({
        email: z.string().optional(),
        identification: z
          .object({ type: z.string().optional(), number: z.string().optional() })
          .optional(),
      })
      .optional(),
  }),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`pay:${clientIp(request)}`, 15, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de pagamento inválidos" }, { status: 400 });
  }

  const order = await getOrderById(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ status: "approved", orderId: order.id });
  }

  const form = {
    ...parsed.data.formData,
    issuer_id:
      parsed.data.formData.issuer_id != null
        ? String(parsed.data.formData.issuer_id)
        : undefined,
  } as BrickFormData;

  try {
    const result = await createPayment({
      orderId: order.id,
      orderNumber: order.number,
      amount: order.total, // total do servidor — nunca o valor do cliente
      payerEmail: order.email,
      form,
    });

    if (result.status === "approved") {
      await approveOrder(order.id, {
        mpPaymentId: result.id,
        mpStatus: result.status,
        method: result.payment_method_id,
        netAmount: result.netReceivedAmount ?? null,
      });
    } else if (result.status === "rejected") {
      await setOrderStatus(order.id, "pending", {
        mpStatus: "rejected",
        mpPaymentId: result.id,
      });
    } else {
      // pending / in_process (ex.: Pix aguardando)
      await setOrderStatus(order.id, "pending", {
        mpStatus: result.status,
        mpPaymentId: result.id,
      });
    }

    return NextResponse.json({
      status: result.status,
      status_detail: result.status_detail,
      orderId: order.id,
      pix: result.pix ?? null,
    });
  } catch (err) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const e = err as any;
    const cause = e?.cause?.[0]?.description ?? e?.causes?.[0]?.description;
    console.error("payments/process error", cause ?? e?.message ?? err);
    return NextResponse.json(
      {
        error: "Não foi possível processar o pagamento.",
        detail: cause ?? e?.message ?? null,
      },
      { status: 502 },
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
