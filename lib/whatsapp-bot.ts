import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { formatBRL } from "@/lib/format";
import { notifyNumbers } from "@/lib/whatsapp";
import { adminListProducts } from "@/lib/data/admin";
import { createOrder, approveOrder, listAllOrders } from "@/lib/data/orders";
import { logAction } from "@/lib/data/audit";
import type { Order, Product, ProductVariant } from "@/lib/types";

/**
 * Bot de comandos por WhatsApp: "vendi 1 body canelado azul pra Priscila"
 * registra a venda (mesmo caminho do PDV, pagamento "dinheiro"), "quanto
 * vendi hoje?" responde o total do período. Webhook em
 * app/api/webhooks/whatsapp/route.ts recebe a mensagem e chama
 * handleWhatsAppMessage() aqui.
 *
 * Duas camadas de segurança (o webhook cria pedido/baixa estoque, então
 * NENHUMA das duas é opcional):
 *  1. verifyMetaSignature() prova que o payload realmente veio da Meta
 *     (sem isso, qualquer um poderia forjar "de: seu número").
 *  2. isAuthorizedWhatsAppNumber() só deixa passar quem está em
 *     WHATSAPP_NOTIFY_NUMBERS (os mesmos números que recebem o aviso de
 *     venda — reaproveitado aqui como lista de quem pode comandar o bot).
 *
 * A interpretação da mensagem usa a API da Claude (Haiku, barato) só pra
 * extrair intenção/entidades — o CASAMENTO com o catálogo real (produto,
 * cor, tamanho, estoque) é feito aqui em código, não pela IA, pra manter
 * controle sobre o que efetivamente cria um pedido.
 */

const POS_FALLBACK_EMAIL = "venda-loja@miilo.com.br";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MAX_MESSAGE_LENGTH = 500;

// --------------------------------------------------------------------------
//  Segurança do webhook
// --------------------------------------------------------------------------

/** Confere a assinatura HMAC que a Meta manda em X-Hub-Signature-256. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Só quem está em WHATSAPP_NOTIFY_NUMBERS pode comandar o bot. */
export function isAuthorizedWhatsAppNumber(phone: string): boolean {
  return notifyNumbers().includes(phone);
}

// --------------------------------------------------------------------------
//  Interpretação da mensagem (Claude)
// --------------------------------------------------------------------------

type Intent =
  | {
      intent: "log_sale";
      product_text?: string;
      variant_text?: string;
      qty?: number;
      customer_name?: string;
    }
  | { intent: "query_sales"; period?: "today" | "yesterday" | "week" | "month" }
  | { intent: "unknown" };

const INTERPRET_TOOL = {
  name: "interpret_message",
  description: "Registra a interpretação estruturada da mensagem do lojista.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["log_sale", "query_sales", "unknown"],
        description:
          "log_sale = a pessoa está avisando que vendeu algo. query_sales = está perguntando " +
          "quanto vendeu. unknown = não deu pra entender.",
      },
      product_text: {
        type: "string",
        description: "Trecho que descreve o produto vendido, ex.: 'body canelado'.",
      },
      variant_text: {
        type: "string",
        description: "Cor e/ou tamanho mencionados, ex.: 'azul claro P'.",
      },
      qty: { type: "integer", description: "Quantidade vendida (padrão 1 se não especificada)." },
      customer_name: { type: "string", description: "Nome do cliente, se mencionado." },
      period: {
        type: "string",
        enum: ["today", "yesterday", "week", "month"],
        description: "Período perguntado numa query_sales (padrão 'today').",
      },
    },
    required: ["intent"],
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function interpretMessage(text: string): Promise<Intent> {
  if (!process.env.ANTHROPIC_API_KEY) return { intent: "unknown" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system:
          "Você extrai dados de mensagens curtas de WhatsApp de quem vende numa lojinha infantil " +
          "(roupas, brinquedos e livros). Duas intenções possíveis: 'log_sale' (avisando que vendeu " +
          "algo) ou 'query_sales' (perguntando quanto vendeu). Se não der pra entender, use 'unknown'. " +
          "Nunca invente produto, quantidade ou nome de cliente que não estejam escritos na mensagem.",
        messages: [{ role: "user", content: text }],
        tools: [INTERPRET_TOOL],
        tool_choice: { type: "tool", name: "interpret_message" },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp-bot] Anthropic respondeu", res.status, await res.text().catch(() => ""));
      return { intent: "unknown" };
    }
    const data = await res.json();
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    return toolUse?.input ? (toolUse.input as Intent) : { intent: "unknown" };
  } catch (err) {
    console.error("[whatsapp-bot] erro ao interpretar mensagem", err);
    return { intent: "unknown" };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --------------------------------------------------------------------------
//  Casamento com o catálogo
// --------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function variantLabel(v: ProductVariant): string {
  return [v.size, v.color].filter(Boolean).join(" · ");
}

type MatchResult =
  | { type: "ok"; product: Product; variant: ProductVariant }
  | { type: "none" }
  | { type: "ambiguous_product"; names: string[] }
  | { type: "ambiguous_variant"; product: Product; options: string[] };

function scoreByTokens(target: string, query: string, queryTokens: string[]): number {
  if (target === query) return 100;
  if (target.includes(query)) return 80;
  const matched = queryTokens.filter((t) => target.includes(t)).length;
  return matched > 0 ? (matched / queryTokens.length) * 60 : 0;
}

function matchProduct(products: Product[], productText: string, variantText?: string): MatchResult {
  const q = normalize(productText);
  const qTokens = q.split(/\s+/).filter(Boolean);

  const scored = products
    .filter((p) => p.active)
    .map((p) => ({ product: p, score: scoreByTokens(normalize(p.name), q, qTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { type: "none" };

  const top = scored[0].score;
  const tied = scored.filter((s) => s.score === top);
  if (tied.length > 1) {
    return { type: "ambiguous_product", names: tied.slice(0, 5).map((s) => s.product.name) };
  }

  const product = scored[0].product;
  const variants = product.variants.filter((v) => v.active);
  if (variants.length === 0) return { type: "none" };
  if (variants.length === 1) return { type: "ok", product, variant: variants[0] };

  if (variantText) {
    const vq = normalize(variantText);
    const vTokens = vq.split(/\s+/).filter(Boolean);
    const vScored = variants
      .map((v) => ({ variant: v, score: scoreByTokens(normalize(variantLabel(v)), vq, vTokens) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (vScored.length === 1 || (vScored.length > 1 && vScored[0].score > vScored[1].score)) {
      return { type: "ok", product, variant: vScored[0].variant };
    }
  }

  return {
    type: "ambiguous_variant",
    product,
    options: variants.map((v) => variantLabel(v) || "Único"),
  };
}

// --------------------------------------------------------------------------
//  Ações
// --------------------------------------------------------------------------

async function logSaleFromWhatsApp(parsed: Extract<Intent, { intent: "log_sale" }>): Promise<string> {
  if (!parsed.product_text) {
    return 'Não entendi qual produto foi vendido. Pode mandar de novo, tipo "vendi 1 body canelado azul pra Priscila"?';
  }
  const qty = parsed.qty && parsed.qty > 0 ? Math.floor(parsed.qty) : 1;

  const products = await adminListProducts();
  const match = matchProduct(products, parsed.product_text, parsed.variant_text);

  if (match.type === "none") {
    return `Não achei nenhum produto parecido com "${parsed.product_text}". Confere o nome?`;
  }
  if (match.type === "ambiguous_product") {
    return `Achei mais de um produto parecido: ${match.names.join(", ")}. Qual deles?`;
  }
  if (match.type === "ambiguous_variant") {
    return `"${match.product.name}" tem mais de uma variação: ${match.options.join(", ")}. Qual delas?`;
  }

  const { product, variant } = match;
  const label = variantLabel(variant);
  if (variant.stock < qty) {
    return `Só tem ${variant.stock} em estoque de ${product.name}${label ? ` (${label})` : ""}. Confirma a quantidade?`;
  }

  try {
    const order = await createOrder({
      email: POS_FALLBACK_EMAIL,
      name: parsed.customer_name?.trim() || "Cliente da loja",
      phone: null,
      userId: null,
      deliveryMode: "pickup",
      address: null,
      shipping: { company: "", service: "Venda na loja", price: 0 },
      lines: [{ variantId: variant.id, qty }],
      channel: "pos",
      notes: "Registrado via WhatsApp",
      posPayMode: "cash",
    });
    await approveOrder(order.id, { mpStatus: "manual", method: "dinheiro" });
    await logAction({
      action: "pos.sale",
      entity: "order",
      entityId: order.id,
      summary: `Venda na loja ${order.number} — ${formatBRL(order.total)} (via WhatsApp)`,
    });
    revalidatePath("/admin/pdv");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");

    return [
      "✅ Venda registrada!",
      `Pedido ${order.number} — ${formatBRL(order.total)}`,
      `${qty}x ${product.name}${label ? ` (${label})` : ""}`,
      parsed.customer_name ? `Cliente: ${parsed.customer_name}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (err) {
    console.error("[whatsapp-bot] erro ao registrar venda", err);
    return "Deu erro ao registrar a venda. Tenta de novo ou usa o painel.";
  }
}

const isSold = (o: Order) =>
  ["paid", "shipped", "delivered"].includes(o.status) ||
  (o.channel === "pos" && o.status === "pending");

function rangeFor(period: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  if (period === "yesterday") {
    return {
      start: startOfDay(new Date(now.getTime() - 86_400_000)),
      end: startOfDay(now),
      label: "ontem",
    };
  }
  if (period === "week") {
    return {
      start: startOfDay(new Date(now.getTime() - 6 * 86_400_000)),
      end: new Date(now.getTime() + 1),
      label: "nos últimos 7 dias",
    };
  }
  if (period === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getTime() + 1),
      label: "neste mês",
    };
  }
  return { start: startOfDay(now), end: new Date(now.getTime() + 1), label: "hoje" };
}

async function answerSalesQuery(period: string): Promise<string> {
  const { start, end, label } = rangeFor(period);
  const orders = await listAllOrders();
  const inRange = orders.filter((o) => {
    if (!isSold(o)) return false;
    const created = new Date(o.created_at);
    return created >= start && created < end;
  });
  if (inRange.length === 0) return `Nenhuma venda ${label}.`;
  const total = inRange.reduce((s, o) => s + o.total, 0);
  return `📊 Vendido ${label}: ${formatBRL(total)} em ${inRange.length} pedido${inRange.length > 1 ? "s" : ""}.`;
}

// --------------------------------------------------------------------------
//  Ponto de entrada
// --------------------------------------------------------------------------

const HELP_TEXT =
  'Não entendi 🤔 Manda algo tipo "vendi 1 body canelado azul pra Priscila" ou "quanto vendi hoje?".';

export async function handleWhatsAppMessage(text: string): Promise<string> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return HELP_TEXT;

  const parsed = await interpretMessage(trimmed);
  if (parsed.intent === "query_sales") return answerSalesQuery(parsed.period ?? "today");
  if (parsed.intent === "log_sale") return logSaleFromWhatsApp(parsed);
  return HELP_TEXT;
}
