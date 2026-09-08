import { NextResponse } from "next/server";
import { assertValidWebhook, getPayment } from "@/lib/mercadopago";
import {
  approveOrder,
  getOrderById,
  recordPaymentEvent,
  setOrderStatus,
} from "@/lib/data/orders";

/**
 * Webhook do Mercado Pago (Notificações -> Webhooks).
 * Valida a assinatura, consulta o pagamento e atualiza o pedido.
 * Idempotente: eventos repetidos são ignorados via payment_events.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const dataIdQuery = url.searchParams.get("data.id");

  let payload: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    payload = await request.json();
  } catch {
    /* corpo pode vir vazio em alguns testes */
  }

  try {
    assertValidWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: dataIdQuery ?? payload.data?.id ?? null,
    });
  } catch (err) {
    console.warn("webhook assinatura inválida", err);
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const type = payload.type ?? payload.action ?? "";
  const paymentId = payload.data?.id ?? dataIdQuery ?? null;

  if (!type.includes("payment") || !paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = await getPayment(String(paymentId));
  const orderId = payment.external_reference ?? null;

  const isNew = await recordPaymentEvent({
    orderId,
    mpPaymentId: payment.id,
    type,
    status: payment.status,
    raw: payload,
  });
  if (!isNew) return NextResponse.json({ ok: true, duplicate: true });

  if (!orderId || !(await getOrderById(orderId))) {
    return NextResponse.json({ ok: true, unmatched: true });
  }

  if (payment.status === "approved") {
    await approveOrder(orderId, {
      mpPaymentId: payment.id,
      mpStatus: payment.status,
      method: payment.payment_method_id,
    });
  } else if (payment.status === "rejected" || payment.status === "cancelled") {
    await setOrderStatus(orderId, "failed", {
      mpStatus: payment.status,
      mpPaymentId: payment.id,
    });
  }

  return NextResponse.json({ ok: true });
}

// O Mercado Pago às vezes faz um GET de verificação
export async function GET() {
  return NextResponse.json({ ok: true });
}
