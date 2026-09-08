import { NextResponse } from "next/server";
import { paymentsMocked } from "@/lib/env";
import { approveOrder, getOrderById } from "@/lib/data/orders";

/**
 * Atalho só para o MODO DEMONSTRAÇÃO: confirma um Pix "pendente" na hora,
 * simulando a notificação do banco. Indisponível quando há credenciais reais.
 */
export async function POST(request: Request) {
  if (!paymentsMocked()) {
    return NextResponse.json({ error: "indisponível" }, { status: 403 });
  }
  const { orderId } = await request.json().catch(() => ({ orderId: null }));
  if (!orderId) return NextResponse.json({ error: "orderId" }, { status: 400 });

  const order = await getOrderById(orderId);
  if (!order) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await approveOrder(orderId, { mpStatus: "approved", method: "pix" });
  return NextResponse.json({ ok: true });
}
