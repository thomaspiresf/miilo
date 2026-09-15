import "server-only";
import { formatBRL } from "@/lib/format";
import { hasOpenServiceWindow } from "@/lib/whatsapp-shared";
import type { Order } from "@/lib/types";

/**
 * Notificação de venda no WhatsApp do lojista (Thomas/Thaisa) — via WhatsApp
 * Cloud API oficial da Meta, direto (sem gateway pago tipo Z-API: você paga
 * só por mensagem enviada pra Meta, sem mensalidade fixa, e dá pra usar o
 * número de teste gratuito da Meta pra notificar até 5 destinatários sem
 * precisar de verificação de empresa).
 *
 * A API oficial só manda mensagem de texto livre pra quem falou com o
 * número nas últimas 24h — pra um aviso automático que pode chegar a
 * qualquer hora, precisa de uma "message template" aprovada pela Meta
 * (ver WHATSAPP_TEMPLATE_NAME abaixo). Sem as credenciais + template
 * configurados, vira no-op.
 *
 * Isto é só um AVISO pro dono da loja — não tem nada a ver com o
 * NEXT_PUBLIC_GA_MEASUREMENT_ID/GA_* (analytics) nem com e-mail pro cliente
 * (lib/email.ts).
 *
 * O bot que RECEBE comando ("vendi 1 body...") mora em lib/whatsapp-bot.ts
 * e usa sendWhatsAppText daqui pra responder (dentro da janela de 24h
 * aberta por quem mandou a mensagem — não precisa de template).
 */

const GRAPH_VERSION = "v21.0";
const DEFAULT_TEMPLATE_LANG = "pt_BR";

function graphUrl() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

/** Token + Phone Number ID configurados — o mínimo pra mandar qualquer mensagem. */
export function hasWhatsAppCredentials() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Credenciais + template aprovado — necessário só pro aviso automático (notifySale). */
export function whatsappEnabled() {
  return Boolean(hasWhatsAppCredentials() && process.env.WHATSAPP_TEMPLATE_NAME);
}

export function notifyNumbers(): string[] {
  return (process.env.WHATSAPP_NOTIFY_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Manda texto livre — só funciona respondendo dentro da janela de 24h de uma
 * conversa que a PESSOA iniciou (ex.: o bot de comandos). Pra mensagem que a
 * loja inicia sozinha, use sendWhatsAppTemplate/notifySale.
 */
export type SendResult = { ok: boolean; id: string | null };

export async function sendWhatsAppText(to: string, message: string): Promise<SendResult> {
  if (!hasWhatsAppCredentials()) {
    console.info(`[whatsapp] desativado (faltam credenciais da Meta) — mensagem pra ${to} não enviada`);
    return { ok: false, id: null };
  }
  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] Meta respondeu", res.status, await res.text().catch(() => ""));
      return { ok: false, id: null };
    }
    const data = await res.json().catch(() => null);
    const id = typeof data?.messages?.[0]?.id === "string" ? data.messages[0].id : null;
    return { ok: true, id };
  } catch (err) {
    console.error("[whatsapp] erro ao enviar", err);
    return { ok: false, id: null };
  }
}

/**
 * Manda a mensagem-modelo pra um número. `params` preenche as variáveis
 * {{1}}, {{2}}... do corpo do template, na ordem.
 */
async function sendWhatsAppTemplate(to: string, params: string[]): Promise<boolean> {
  if (!whatsappEnabled()) {
    console.info(`[whatsapp] desativado (faltam credenciais/template da Meta) — mensagem pra ${to} não enviada`);
    return false;
  }
  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || DEFAULT_TEMPLATE_LANG },
          components: [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] Meta respondeu", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] erro ao enviar", err);
    return false;
  }
}

/**
 * Parâmetros do template "nova_venda" (ver instruções de cadastro no chat):
 * {{1}} número do pedido · {{2}} valor total · {{3}} nome do cliente ·
 * {{4}} e-mail do cliente · {{5}} itens.
 */
function saleTemplateParams(order: Order): string[] {
  const itens = order.items
    .map((it) => `${it.qty}x ${it.product_name}${it.variant_label ? ` (${it.variant_label})` : ""}`)
    .join(" · ");

  return [order.number, formatBRL(order.total), order.customer_name || "Cliente da loja", order.email, itens];
}

/** Mesmo texto do template "nova_venda", mas como mensagem livre (ver notifySale). */
function saleMessageText(order: Order): string {
  const [number, total, customer, email, itens] = saleTemplateParams(order);
  return `🛍️ Nova venda confirmada na loja miilo! Pedido número ${number}, no valor total de ${total}. Comprado por ${customer}, e-mail de contato ${email}. Item vendido: ${itens}. Obrigado por mais essa venda!`;
}

/**
 * Avisa o(s) número(s) configurado(s) que um pedido acabou de ser pago.
 *
 * Prioriza texto livre (sendWhatsAppText) quando o número já tem uma janela
 * de 24h aberta (mandou mensagem pro bot recentemente) — funciona sem
 * template aprovado nem forma de pagamento cadastrada na Meta, então o
 * aviso já sai mesmo enquanto o "nova_venda" ainda não foi aprovado. Fora da
 * janela, cai pro template (única forma de iniciar conversa fora dela).
 */
export async function notifySale(order: Order): Promise<void> {
  const numbers = notifyNumbers();
  if (numbers.length === 0) return;
  const params = saleTemplateParams(order);
  const text = saleMessageText(order);

  await Promise.all(
    numbers.map(async (to) => {
      if (await hasOpenServiceWindow(to)) {
        const sent = await sendWhatsAppText(to, text);
        if (sent.ok) return;
      }
      await sendWhatsAppTemplate(to, params);
    }),
  );
}
