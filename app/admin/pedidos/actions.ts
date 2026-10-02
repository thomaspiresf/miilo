"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { getOrderById } from "@/lib/data/orders";
import { sendManualReply } from "@/lib/data/whatsapp-conversations";
import { chargeMessageText } from "@/lib/whatsapp";
import { logAction } from "@/lib/data/audit";
import { site } from "@/lib/site";

/**
 * Manda a cobrança de uma venda "a receber"/"com link" pro WhatsApp do
 * cliente — o número da loja é um número de API (Meta Cloud API), não dá
 * mais pra digitar e mandar pelo WhatsApp normal do celular, então o envio
 * sai direto daqui (mesmo caminho do /admin/conversas).
 *
 * Só funciona se o cliente tiver uma janela de 24h aberta (mandou mensagem
 * pro número recentemente) — fora disso a Cloud API recusa texto livre.
 */
export async function chargeOrderAction(
  orderId: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const order = await getOrderById(orderId);
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (!order.phone) return { ok: false, error: "Esse pedido não tem telefone cadastrado." };

  const payUrl = `${site.url}/pagar/${order.id}`;
  const message = (text?.trim() || chargeMessageText(order, payUrl)).trim();
  if (!message) return { ok: false, error: "Mensagem vazia." };

  const actor = await currentActor();
  const phone = `55${order.phone}`;
  const result = await sendManualReply(phone, message, actor);
  if (!result.ok) {
    return {
      ok: false,
      error:
        "Não consegui enviar — o cliente provavelmente não tem uma janela de 24h aberta (não mandou mensagem recente pro número).",
    };
  }

  await logAction({
    action: "order.charge",
    entity: "order",
    entityId: order.id,
    summary: `Cobrança enviada por WhatsApp — pedido ${order.number}`,
  });
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/conversas");
  return { ok: true };
}
