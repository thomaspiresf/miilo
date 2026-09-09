import { NextResponse } from "next/server";
import { paymentsMocked, isProd } from "@/lib/env";
import { approveOrder, getOrderById } from "@/lib/data/orders";

/**
 * Atalho só para o MODO DEMONSTRAÇÃO: confirma um Pix "pendente" na hora,
 * simulando a notificação do banco. Indisponível quando há credenciais reais.
 */
export async function POST(request: Request) {
  // Em produção esta rota não existe (nem se as credenciais do MP sumirem).
  if (isProd || !paymentsMocked()) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  const { orderId } = await request.json().catch(() => ({ orderId: null }));
  if (!orderId) return NextResponse.json({ error: "orderId" }, { status: 400 });

  const order = await getOrderById(orderId);
  if (!order) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await approveOrder(orderId, { mpStatus: "approved", method: "pix" });
  return NextResponse.json({ ok: true });
}
