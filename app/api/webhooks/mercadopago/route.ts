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

  // Valida a assinatura quando há segredo configurado. Se não bater, apenas
  // registra o aviso e SEGUE — o pagamento é sempre re-consultado no MP com o
  // access token (fonte da verdade), então uma assinatura errada/desatualizada
  // não deve travar a confirmação do pedido.
  try {
    assertValidWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: dataIdQuery ?? payload.data?.id ?? null,
    });
  } catch (err) {
    console.warn(
      "webhook MP: assinatura não confere (verifique MP_WEBHOOK_SECRET) —",
      (err as Error).message,
    );
  }

  const type = payload.type ?? payload.action ?? "";
  const paymentId = payload.data?.id ?? dataIdQuery ?? null;

  if (!type.includes("payment") || !paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let payment;
  try {
    payment = await getPayment(String(paymentId));
  } catch (err) {
    // pagamento não encontrado (ex.: teste do painel do MP) — responde 200 mesmo assim
    console.warn("webhook: pagamento não encontrado", paymentId, (err as Error).message);
    return NextResponse.json({ ok: true, notFound: true });
  }
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
