import "server-only";
import { formatBRL } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import type { Order } from "@/lib/types";

/**
 * Envio de e-mail transacional via Resend (API REST — sem SDK).
 * Sem RESEND_API_KEY configurada, tudo vira no-op (o app segue em modo demo).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || "miilo";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.miilo.com.br").replace(/\/$/, "");

/** Remetente. Ex.: "miilo <pedidos@miilo.com.br>". Precisa ser de um domínio verificado no Resend. */
function fromAddress() {
  return process.env.RESEND_FROM || `${STORE_NAME} <pedidos@miilo.com.br>`;
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

type SendInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail(input: SendInput): Promise<boolean> {
  if (!emailEnabled()) {
    console.info(`[email] desativado (sem RESEND_API_KEY) — "${input.subject}"`);
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend respondeu", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] erro ao enviar", err);
    return false;
  }
}

// --------------------------------------------------------------------------
//  Layout
// --------------------------------------------------------------------------
function layout(bodyHtml: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fbfbfd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16181d;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <a href="${SITE_URL}" style="font-size:26px;font-weight:800;color:#ff514f;text-decoration:none;letter-spacing:-0.02em;">miilo</a>
    </div>
    <div style="background:#ffffff;border:1px solid #e9e9ef;border-radius:16px;padding:24px;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#6b7280;font-size:12px;line-height:1.6;margin:20px 8px 0;">
      ${STORE_NAME} · roupas e brinquedos infantis<br>
      <a href="${SITE_URL}" style="color:#6b7280;">www.miilo.com.br</a>
    </p>
  </div>
</body></html>`;
}

function itemsTable(order: Order) {
  const rows = order.items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;font-size:14px;">
          ${escapeHtml(it.product_name)}${it.variant_label ? ` <span style="color:#6b7280;">· ${escapeHtml(it.variant_label)}</span>` : ""}
          <span style="color:#6b7280;"> ×${it.qty}</span>
        </td>
        <td style="padding:8px 0;font-size:14px;text-align:right;white-space:nowrap;">${formatBRL(it.unit_price * it.qty)}</td>
      </tr>`,
    )
    .join("");

  const frete =
    order.shipping_cost > 0
      ? formatBRL(order.shipping_cost)
      : order.delivery_mode === "pickup"
        ? "Retirada"
        : "Grátis";

  return `<table style="width:100%;border-collapse:collapse;margin-top:4px;">
    ${rows}
    <tr><td colspan="2" style="border-top:1px solid #e9e9ef;padding-top:8px;"></td></tr>
    <tr>
      <td style="padding:2px 0;font-size:14px;color:#6b7280;">Subtotal</td>
      <td style="padding:2px 0;font-size:14px;text-align:right;color:#6b7280;">${formatBRL(order.subtotal)}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;font-size:14px;color:#6b7280;">Frete</td>
      <td style="padding:2px 0;font-size:14px;text-align:right;color:#6b7280;">${frete}</td>
    </tr>
    <tr>
      <td style="padding:6px 0 0;font-size:16px;font-weight:700;">Total</td>
      <td style="padding:6px 0 0;font-size:16px;font-weight:700;text-align:right;">${formatBRL(order.total)}</td>
    </tr>
  </table>`;
}

function addressBlock(order: Order) {
  if (order.delivery_mode === "pickup" || !order.address) {
    return `<p style="font-size:14px;color:#6b7280;margin:0;">Retirada na loja — avisaremos quando estiver pronto.</p>`;
  }
  const a = order.address;
  return `<p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">
    ${escapeHtml(a.street)}, ${escapeHtml(a.number)}${a.complement ? ` — ${escapeHtml(a.complement)}` : ""}<br>
    ${escapeHtml(a.district)} · ${escapeHtml(a.city)}/${escapeHtml(a.state)}<br>
    CEP ${escapeHtml(a.cep)}
  </p>`;
}

// --------------------------------------------------------------------------
//  Confirmação de pedido pago
// --------------------------------------------------------------------------
export async function sendOrderConfirmationEmail(order: Order): Promise<boolean> {
  if (!order.email || order.email.endsWith("@miilo.com.br")) return false; // vendas na loja sem e-mail real

  const statusLabel = ORDER_STATUS[order.status]?.label ?? "Confirmado";
  const orderUrl = `${SITE_URL}/pedido/${order.id}`;
  const firstName = (order.customer_name || "").trim().split(/\s+/)[0] || "";

  const html = layout(`
    <p style="font-size:15px;margin:0 0 4px;">${firstName ? `Oi, ${escapeHtml(firstName)}! ` : ""}Recebemos seu pagamento 🎉</p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">Pedido <strong style="color:#16181d;">${escapeHtml(order.number)}</strong> · ${escapeHtml(statusLabel)}</p>

    ${itemsTable(order)}

    <h3 style="font-size:14px;margin:20px 0 6px;">Entrega</h3>
    ${addressBlock(order)}

    <div style="text-align:center;margin-top:22px;">
      <a href="${orderUrl}" style="display:inline-block;background:#ff514f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px;">Acompanhar pedido</a>
    </div>
  `);

  return sendEmail({
    to: order.email,
    subject: `Pedido ${order.number} confirmado · ${STORE_NAME}`,
    html,
    replyTo: "contato@miilo.com.br",
  });
}

// --------------------------------------------------------------------------
//  Aviso "voltou ao estoque"
// --------------------------------------------------------------------------
export async function sendRestockEmail(input: {
  to: string;
  productName: string;
  productSlug: string;
  variantLabel?: string | null;
}): Promise<boolean> {
  const url = `${SITE_URL}/p/${input.productSlug}`;
  const alvo = input.variantLabel
    ? `${escapeHtml(input.productName)} <span style="color:#6b7280;">(${escapeHtml(input.variantLabel)})</span>`
    : escapeHtml(input.productName);

  const html = layout(`
    <p style="font-size:15px;margin:0 0 4px;">Voltou! 🐰</p>
    <p style="font-size:14px;color:#16181d;margin:0 0 16px;line-height:1.6;">
      <strong>${alvo}</strong> está disponível de novo na loja.
      Corre que pode acabar rápido.
    </p>
    <div style="text-align:center;margin-top:8px;">
      <a href="${url}" style="display:inline-block;background:#ff514f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px;">Ver produto</a>
    </div>
  `);

  return sendEmail({
    to: input.to,
    subject: `Voltou ao estoque: ${input.productName} · ${STORE_NAME}`,
    html,
    replyTo: "contato@miilo.com.br",
  });
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
