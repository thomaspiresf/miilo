import "server-only";
import { paymentsMocked } from "@/lib/env";
import { getPayment } from "@/lib/mercadopago";
import { approveOrder, getOrderById, setOrderStatus } from "@/lib/data/orders";

/**
 * Re-consulta o pagamento de um pedido no Mercado Pago e atualiza o status.
 * Serve de rede de segurança pro webhook: mesmo se a notificação do MP falhar,
 * o pedido é confirmado quando alguém abre a página do pedido (polling) ou o
 * admin abre o pedido. Idempotente e silencioso — nunca lança.
 */
export async function reconcileOrderPayment(
  orderId: string,
  mpPaymentId?: string | null,
): Promise<void> {
  if (paymentsMocked()) return;
  try {
    const order = await getOrderById(orderId);
    if (!order || order.status !== "pending") return;

    const payId = mpPaymentId || order.mp_payment_id;
    if (!payId) return;

    const payment = await getPayment(String(payId));

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
  } catch (err) {
    console.warn("reconcileOrderPayment", orderId, (err as Error).message);
  }
}

/** QR/copia-e-cola de um pagamento Pix ainda pendente (pra mostrar de novo ao cliente). */
export async function pixQrForPayment(
  mpPaymentId: string,
): Promise<{ qr_code: string; qr_code_base64: string | null } | null> {
  if (paymentsMocked()) return null;
  try {
    const p = await getPayment(mpPaymentId);
    if (p.status === "pending" && p.pix?.qr_code) {
      return { qr_code: p.pix.qr_code, qr_code_base64: p.pix.qr_code_base64 ?? null };
    }
  } catch {
    /* silencioso */
  }
  return null;
}
