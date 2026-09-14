import "server-only";
import { formatBRL } from "@/lib/format";
import type { Order } from "@/lib/types";

/**
 * Notificação de venda no WhatsApp do lojista (Thomas/Thaisa) — via Z-API
 * (mesmo provedor já usado no projeto "Atendimento Angelini": conecta um
 * número real de WhatsApp por QR Code, sem burocracia de App/template da
 * Meta). Sem ZAPI_INSTANCE_ID/ZAPI_TOKEN/ZAPI_CLIENT_TOKEN configurados,
 * vira no-op (as contas Z-API mais novas exigem as três pra autenticar).
 *
 * Isto é só um AVISO pro dono da loja — não tem nada a ver com o
 * NEXT_PUBLIC_GA_MEASUREMENT_ID/GA_* (analytics) nem com e-mail pro cliente
 * (lib/email.ts).
 */

function zapiBaseUrl() {
  const base = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
  return `${base}/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;
}

export function whatsappEnabled() {
  return Boolean(
    process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN && process.env.ZAPI_CLIENT_TOKEN,
  );
}

function notifyNumbers(): string[] {
  return (process.env.WHATSAPP_NOTIFY_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Manda texto simples pra um número (formato Z-API: DDI+DDD+número, sem símbolos). */
async function sendWhatsAppText(to: string, message: string): Promise<boolean> {
  if (!whatsappEnabled()) {
    console.info(`[whatsapp] desativado (faltam credenciais Z-API) — mensagem pra ${to} não enviada`);
    return false;
  }
  try {
    const res = await fetch(`${zapiBaseUrl()}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": process.env.ZAPI_CLIENT_TOKEN!,
      },
      body: JSON.stringify({ phone: to, message }),
    });
    if (!res.ok) {
      console.error("[whatsapp] Z-API respondeu", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] erro ao enviar", err);
    return false;
  }
}

function saleMessage(order: Order): string {
  const canal = order.channel === "pos" ? "Venda na loja" : "Loja online";
  const itens = order.items
    .map((it) => `${it.qty}× ${it.product_name}${it.variant_label ? ` (${it.variant_label})` : ""}`)
    .join("\n");

  return [
    "🛍️ *Venda confirmada!*",
    `Pedido ${order.number} — ${formatBRL(order.total)}`,
    canal,
    "",
    itens,
  ].join("\n");
}

/** Avisa o(s) número(s) configurado(s) que um pedido acabou de ser pago. */
export async function notifySale(order: Order): Promise<void> {
  const numbers = notifyNumbers();
  if (numbers.length === 0) return;
  const text = saleMessage(order);
  await Promise.all(numbers.map((to) => sendWhatsAppText(to, text)));
}
