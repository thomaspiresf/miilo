"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { getOrderById } from "@/lib/data/orders";
import { pauseConversation } from "@/lib/data/whatsapp-conversations";
import { hasOpenServiceWindow, saveTurns, attachWamid } from "@/lib/whatsapp-shared";
import { sendWhatsAppText, sendChargeTemplate, chargeMessageText, hasChargeTemplate } from "@/lib/whatsapp";
import { logAction } from "@/lib/data/audit";
import { site } from "@/lib/site";

/**
 * Manda a cobrança de uma venda "a receber"/"com link" pro WhatsApp do
 * cliente — o número da loja é um número de API (Meta Cloud API), não dá
 * mais pra digitar e mandar pelo WhatsApp normal do celular, então o envio
 * sai direto daqui (mesmo caminho do /admin/conversas).
 *
 * Prioriza texto livre quando o cliente tem uma janela de 24h aberta (igual
 * ao aviso de venda — ver notifySale em lib/whatsapp.ts); fora da janela,
 * cai pro template "cobranca_pedido" (único jeito de iniciar conversa nesse
 * caso — a maioria dos clientes "a receber" nunca falou com o bot).
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

  let sent = (await hasOpenServiceWindow(phone))
    ? await sendWhatsAppText(phone, message)
    : { ok: false, id: null };

  if (!sent.ok) sent = await sendChargeTemplate(phone, order);

  if (!sent.ok) {
    return {
      ok: false,
      error: hasChargeTemplate()
        ? "Não consegui enviar — confere se as credenciais do WhatsApp estão ok."
        : "Não consegui enviar — o cliente não tem uma janela de 24h aberta e o template de cobrança ainda não está cadastrado/aprovado.",
    };
  }

  await saveTurns(phone, [{ role: "assistant", content: message }]);
  if (sent.id) await attachWamid(phone, sent.id);
  await pauseConversation(phone, actor.email);

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
