import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/data/orders";
import { reconcileOrderPayment } from "@/lib/mp-reconcile";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// no máximo 1 reconciliação com o MP a cada 12s por pedido (o poller roda a 4s)
const lastReconcile = new Map<string, number>();
const RECONCILE_EVERY_MS = 12_000;

export async function GET(
  request: Request,
  context: RouteContext<"/api/orders/[id]/status">,
) {
  const rl = rateLimit(`ostatus:${clientIp(request)}`, 40, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const { id } = await context.params;

  let order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  // pendente + tem pagamento no MP → re-checa (rede de segurança do webhook),
  // mas no máximo 1x a cada 12s por pedido pra não martelar a API do MP
  if (order.status === "pending" && order.mp_payment_id) {
    const now = Date.now();
    if (now - (lastReconcile.get(id) ?? 0) > RECONCILE_EVERY_MS) {
      lastReconcile.set(id, now);
      await reconcileOrderPayment(id, order.mp_payment_id);
      order = (await getOrderById(id)) ?? order;
    }
  }

  return NextResponse.json({ status: order.status, mpStatus: order.mp_status });
}
