import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/data/orders";
import { reconcileOrderPayment } from "@/lib/mp-reconcile";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/orders/[id]/status">,
) {
  const { id } = await context.params;

  let order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  // pendente + tem pagamento no MP → re-checa (rede de segurança do webhook)
  if (order.status === "pending" && order.mp_payment_id) {
    await reconcileOrderPayment(id, order.mp_payment_id);
    order = (await getOrderById(id)) ?? order;
  }

  return NextResponse.json({ status: order.status, mpStatus: order.mp_status });
}
