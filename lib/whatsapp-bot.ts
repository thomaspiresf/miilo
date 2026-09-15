import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { formatBRL } from "@/lib/format";
import { site } from "@/lib/site";
import { notifyNumbers } from "@/lib/whatsapp";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminListProducts } from "@/lib/data/admin";
import { createOrder, approveOrder, listAllOrders } from "@/lib/data/orders";
import { logAction } from "@/lib/data/audit";
import type { Order, Product, ProductVariant } from "@/lib/types";

/**
 * Bot conversacional de WhatsApp pro dono/admins da loja: pode registrar
 * venda ("vendi 1 body canelado azul pra Priscila"), consultar vendas por
 * período, estoque, detalhes de um pedido e ranking de mais vendidos —
 * e lembra da conversa pra responder perguntas de acompanhamento
 * ("e quais foram os itens?"). Webhook em
 * app/api/webhooks/whatsapp/route.ts recebe a mensagem e chama
 * handleWhatsAppMessage() aqui.
 *
 * Duas camadas de segurança (o bot cria pedido/baixa estoque e expõe dados
 * internos, então NENHUMA das duas é opcional):
 *  1. verifyMetaSignature() prova que o payload realmente veio da Meta
 *     (sem isso, qualquer um poderia forjar "de: seu número").
 *  2. isAuthorizedWhatsAppNumber() só deixa passar quem está em
 *     WHATSAPP_NOTIFY_NUMBERS (os mesmos números que recebem o aviso de
 *     venda — reaproveitado aqui como lista de quem pode conversar com o bot).
 *
 * Arquitetura: Claude (Haiku) conduz a conversa e decide quando chamar uma
 * das "ferramentas" abaixo — mas o CASAMENTO com o catálogo real (produto,
 * cor, tamanho, estoque) e a criação do pedido continuam em código, não na
 * IA, pra manter controle sobre o que efetivamente mexe em dinheiro/estoque.
 * As ferramentas de consulta (vendas, estoque, pedido, ranking) devolvem
 * dados estruturados — quem escreve a frase final é o Claude, usando o
 * histórico da conversa (guardado em `whatsapp_conversations`) pra manter
 * contexto entre mensagens.
 */

const POS_FALLBACK_EMAIL = "venda-loja@miilo.com.br";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MAX_MESSAGE_LENGTH = 500;
const MAX_TOOL_ITERATIONS = 4;
const HISTORY_MESSAGES = 12;

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

/** Só quem está em WHATSAPP_NOTIFY_NUMBERS pode conversar com o bot. */
export function isAuthorizedWhatsAppNumber(phone: string): boolean {
  return notifyNumbers().includes(phone);
}

// --------------------------------------------------------------------------
//  Memória da conversa (por número)
// --------------------------------------------------------------------------

type ChatTurn = { role: "user" | "assistant"; content: string };

async function loadHistory(phone: string): Promise<ChatTurn[]> {
  if (!hasSupabaseAdmin()) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("whatsapp_conversations")
      .select("role,content")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES);
    if (error) return [];
    return (data ?? []).reverse() as ChatTurn[];
  } catch {
    return [];
  }
}

async function saveTurns(phone: string, turns: ChatTurn[]): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_conversations").insert(turns.map((t) => ({ phone, role: t.role, content: t.content })));
  } catch (err) {
    console.error("[whatsapp-bot] erro ao salvar memória da conversa", err);
  }
}

// --------------------------------------------------------------------------
//  Casamento com o catálogo (usado por log_sale e get_stock)
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

// Cores como "Azul", "Azul Claro" e "Azul Escuro" convivem no mesmo produto —
// comparar só contra o rótulo combinado ("P · Azul Claro") faz "azul" bater
// como substring nas três e empatar sempre. Aqui um match exato na cor OU no
// tamanho isolados vence antes de cair pro score do rótulo combinado.
function scoreVariant(v: ProductVariant, query: string, queryTokens: string[]): number {
  const color = normalize(v.color || "");
  const size = normalize(v.size || "");
  const sizeAndColor = normalize([v.size, v.color].filter(Boolean).join(" "));
  if (color === query || size === query || sizeAndColor === query) return 100;
  return scoreByTokens(normalize(variantLabel(v)), query, queryTokens);
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
      .map((v) => ({ variant: v, score: scoreVariant(v, vq, vTokens) }))
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

function matchOrderByNumber(orders: Order[], numberText: string): Order | undefined {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const q = clean(numberText);
  if (!q) return undefined;
  return orders.find((o) => clean(o.number) === q) ?? orders.find((o) => clean(o.number).endsWith(q));
}

const isSold = (o: Order) =>
  ["paid", "shipped", "delivered"].includes(o.status) ||
  (o.channel === "pos" && o.status === "pending");

// O servidor roda em UTC — usar setHours() daria meia-noite em UTC (21h em
// Brasília), não meia-noite local. Todo cálculo de dia aqui é feito no
// relógio de Brasília (UTC-3, sem horário de verão desde 2019).
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;
const toBrWallClock = (d: Date) => new Date(d.getTime() - BR_OFFSET_MS);
const fromBrWallClock = (d: Date) => new Date(d.getTime() + BR_OFFSET_MS);
const startOfBrDay = (d: Date) => {
  const wall = toBrWallClock(d);
  wall.setUTCHours(0, 0, 0, 0);
  return fromBrWallClock(wall);
};

function rangeFor(period: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (period === "yesterday") {
    const todayStart = startOfBrDay(now);
    return { start: new Date(todayStart.getTime() - 86_400_000), end: todayStart, label: "ontem" };
  }
  if (period === "week") {
    return {
      start: startOfBrDay(new Date(now.getTime() - 6 * 86_400_000)),
      end: new Date(now.getTime() + 1),
      label: "nos últimos 7 dias",
    };
  }
  if (period === "month") {
    const wall = toBrWallClock(now);
    const firstOfMonth = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1));
    return { start: fromBrWallClock(firstOfMonth), end: new Date(now.getTime() + 1), label: "neste mês" };
  }
  return { start: startOfBrDay(now), end: new Date(now.getTime() + 1), label: "hoje" };
}

/** "2026-09-13" -> meia-noite desse dia em Brasília, já convertida pro instante UTC real. */
function rangeForDate(dateStr: string): { start: Date; end: Date; label: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const [, y, mo, d] = m;
  const wallMidnight = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(wallMidnight.getTime())) return null;
  const start = fromBrWallClock(wallMidnight);
  return { start, end: new Date(start.getTime() + 86_400_000), label: `em ${d}/${mo}/${y}` };
}

function getBrDateLabel(d: Date): string {
  const wall = toBrWallClock(d);
  const dd = String(wall.getUTCDate()).padStart(2, "0");
  const mm = String(wall.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${wall.getUTCFullYear()}`;
}

// --------------------------------------------------------------------------
//  Ferramentas (executadas em código, resultado estruturado pro Claude)
// --------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

async function toolLogSale(input: any): Promise<object> {
  const rawItems = Array.isArray(input.items) ? input.items : null;
  if (!rawItems || rawItems.length === 0) return { ok: false, reason: "missing_items" };
  const customerName = typeof input.customer_name === "string" ? input.customer_name.trim() : "";
  const payment = input.payment === "received" || input.payment === "link" ? input.payment : null;

  const products = await adminListProducts();

  const resolved: { product: Product; variant: ProductVariant; qty: number }[] = [];
  for (const raw of rawItems) {
    const productText = typeof raw?.product_text === "string" ? raw.product_text : "";
    if (!productText) return { ok: false, reason: "missing_product" };
    const qty = Number.isFinite(raw.qty) && raw.qty > 0 ? Math.floor(raw.qty) : 1;
    const variantText = typeof raw.variant_text === "string" ? raw.variant_text : undefined;

    const match = matchProduct(products, productText, variantText);
    if (match.type === "none") return { ok: false, reason: "not_found", query: productText };
    if (match.type === "ambiguous_product") {
      return { ok: false, reason: "ambiguous_product", query: productText, options: match.names };
    }
    if (match.type === "ambiguous_variant") {
      return { ok: false, reason: "ambiguous_variant", product_name: match.product.name, options: match.options };
    }

    const { product, variant } = match;
    if (variant.stock < qty) {
      return {
        ok: false,
        reason: "insufficient_stock",
        product_name: product.name,
        variant_label: variantLabel(variant) || null,
        available: variant.stock,
        requested: qty,
      };
    }
    resolved.push({ product, variant, qty });
  }

  const itemsSummary = resolved.map((r) => ({
    qty: r.qty,
    product_name: r.product.name,
    variant_label: variantLabel(r.variant) || null,
  }));

  // Nunca assume que já foi pago — só cria o pedido depois que a pessoa disser
  // se já recebeu (dinheiro/pix na hora) ou se é pra gerar link de cobrança.
  if (!payment) {
    const previewTotal = resolved.reduce((s, r) => s + r.variant.price * r.qty, 0);
    return {
      ok: false,
      reason: "need_payment_choice",
      customer_name: customerName || null,
      items: itemsSummary,
      total_formatted: formatBRL(previewTotal),
    };
  }

  try {
    const order = await createOrder({
      email: POS_FALLBACK_EMAIL,
      name: customerName || "Cliente da loja",
      phone: null,
      userId: null,
      deliveryMode: "pickup",
      address: null,
      shipping: { company: "", service: "Venda na loja", price: 0 },
      lines: resolved.map((r) => ({ variantId: r.variant.id, qty: r.qty })),
      channel: "pos",
      notes: "Registrado via WhatsApp",
      posPayMode: payment === "received" ? "cash" : "link",
    });
    if (payment === "received") {
      await approveOrder(order.id, { mpStatus: "manual", method: "dinheiro" });
    }
    await logAction({
      action: "pos.sale",
      entity: "order",
      entityId: order.id,
      summary: `Venda na loja ${order.number} — ${formatBRL(order.total)} (via WhatsApp)`,
    });
    revalidatePath("/admin/pdv");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");

    return {
      ok: true,
      order_number: order.number,
      total_formatted: formatBRL(order.total),
      customer_name: customerName || null,
      payment,
      pay_url: payment === "link" ? `${site.url}/pagar/${order.id}` : null,
      items: itemsSummary,
    };
  } catch (err) {
    console.error("[whatsapp-bot] erro ao registrar venda", err);
    return { ok: false, reason: "error" };
  }
}

async function toolGetSalesTotal(input: any): Promise<object> {
  const range =
    (typeof input.date === "string" ? rangeForDate(input.date) : null) ??
    rangeFor(typeof input.period === "string" ? input.period : "today");
  const { start, end, label } = range;
  const orders = await listAllOrders();
  const inRange = orders.filter((o) => {
    if (!isSold(o)) return false;
    const created = new Date(o.created_at);
    return created >= start && created < end;
  });
  const total = inRange.reduce((s, o) => s + o.total, 0);
  return {
    period_label: label,
    total,
    total_formatted: formatBRL(total),
    order_count: inRange.length,
    orders: inRange.map((o) => ({
      number: o.number,
      total_formatted: formatBRL(o.total),
      customer_name: o.customer_name,
      created_at: o.created_at,
      items: o.items.map((it) => ({ product_name: it.product_name, variant_label: it.variant_label, qty: it.qty })),
    })),
  };
}

async function toolGetStock(input: any): Promise<object> {
  const productText = typeof input.product_text === "string" ? input.product_text : "";
  if (!productText) return { found: false, reason: "missing_product" };
  const variantText = typeof input.variant_text === "string" ? input.variant_text : undefined;
  const products = await adminListProducts();
  const match = matchProduct(products, productText, variantText);
  if (match.type === "ok") {
    return {
      found: true,
      product_name: match.product.name,
      variant_label: variantLabel(match.variant) || null,
      stock: match.variant.stock,
    };
  }
  if (match.type === "ambiguous_product") return { found: false, reason: "ambiguous_product", options: match.names };
  if (match.type === "ambiguous_variant") {
    return { found: false, reason: "ambiguous_variant", product_name: match.product.name, options: match.options };
  }
  return { found: false, reason: "not_found", query: productText };
}

async function toolGetOrder(input: any): Promise<object> {
  const orderNumber = typeof input.order_number === "string" ? input.order_number : "";
  if (!orderNumber) return { found: false, reason: "missing_order_number" };
  const orders = await listAllOrders();
  const order = matchOrderByNumber(orders, orderNumber);
  if (!order) return { found: false, reason: "not_found", query: orderNumber };
  return {
    found: true,
    number: order.number,
    status: order.status,
    channel: order.channel,
    total_formatted: formatBRL(order.total),
    customer_name: order.customer_name,
    email: order.email,
    created_at: order.created_at,
    items: order.items.map((it) => ({
      product_name: it.product_name,
      variant_label: it.variant_label,
      qty: it.qty,
      unit_price_formatted: formatBRL(it.unit_price),
    })),
  };
}

async function toolGetTopProducts(input: any): Promise<object> {
  const period = typeof input.period === "string" ? input.period : "month";
  const limit = Number.isFinite(input.limit) && input.limit > 0 ? Math.min(Math.floor(input.limit), 20) : 5;
  const category = typeof input.category === "string" ? input.category : null;

  const orders = await listAllOrders();
  let filtered = orders.filter(isSold);
  let label = "no total";
  if (period !== "all") {
    const r = rangeFor(period);
    label = r.label;
    filtered = filtered.filter((o) => {
      const created = new Date(o.created_at);
      return created >= r.start && created < r.end;
    });
  }

  // Ranking é por PRODUTO (soma todas as variações) — agrupar por
  // produto+variação fazia um item popular com várias cores/tamanhos
  // (poucas unidades cada) ficar escondido atrás de um item de variação
  // única com menos vendas no total.
  let categoryByName: Map<string, string> | null = null;
  if (category) {
    const products = await adminListProducts();
    categoryByName = new Map(products.map((p) => [normalize(p.name), p.category?.kind ?? ""]));
  }

  const agg = new Map<
    string,
    { product_name: string; qty: number; revenue: number; variants: Map<string, number> }
  >();
  for (const o of filtered) {
    for (const it of o.items) {
      if (categoryByName && categoryByName.get(normalize(it.product_name)) !== category) continue;
      const cur = agg.get(it.product_name) ?? {
        product_name: it.product_name,
        qty: 0,
        revenue: 0,
        variants: new Map<string, number>(),
      };
      cur.qty += it.qty;
      cur.revenue += it.unit_price * it.qty;
      const vLabel = it.variant_label || "Único";
      cur.variants.set(vLabel, (cur.variants.get(vLabel) ?? 0) + it.qty);
      agg.set(it.product_name, cur);
    }
  }

  const items = [...agg.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
    .map((i) => ({
      product_name: i.product_name,
      qty: i.qty,
      revenue_formatted: formatBRL(i.revenue),
      variants: [...i.variants.entries()].map(([variant_label, qty]) => ({ variant_label, qty })),
    }));

  return { period_label: label, category, items };
}

async function executeTool(name: string, input: any): Promise<object> {
  switch (name) {
    case "log_sale":
      return toolLogSale(input ?? {});
    case "get_sales_total":
      return toolGetSalesTotal(input ?? {});
    case "get_stock":
      return toolGetStock(input ?? {});
    case "get_order":
      return toolGetOrder(input ?? {});
    case "get_top_products":
      return toolGetTopProducts(input ?? {});
    default:
      return { error: "unknown_tool" };
  }
}

const TOOLS = [
  {
    name: "log_sale",
    description:
      "Registra uma venda na loja (baixa estoque, cria o pedido). Um pedido pode ter mais de um " +
      "item/variação — ex.: o mesmo produto em duas cores diferentes vai como dois itens no mesmo pedido.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Um item por produto/variação vendido nesse pedido.",
          items: {
            type: "object",
            properties: {
              product_text: { type: "string", description: "Nome/descrição do produto, ex.: 'body canelado'." },
              variant_text: { type: "string", description: "Cor e/ou tamanho, ex.: 'M laranja'." },
              qty: { type: "integer", description: "Quantidade desse item (padrão 1)." },
            },
            required: ["product_text"],
          },
        },
        customer_name: { type: "string", description: "Nome do cliente, se mencionado." },
        payment: {
          type: "string",
          enum: ["received", "link"],
          description:
            "'received' se a pessoa disse que já recebeu (dinheiro, pix, cartão na hora). 'link' se " +
            "quer que gere um link de cobrança pra mandar pro cliente. NÃO adivinhe — se a mensagem " +
            "não deixar isso claro, deixe esse campo de fora que a ferramenta avisa que falta perguntar.",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "get_sales_total",
    description: "Consulta o total vendido (pedidos pagos) num período OU numa data específica.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "yesterday", "week", "month"],
          description: "Período relativo (padrão today). Não use junto com 'date'.",
        },
        date: {
          type: "string",
          description:
            "Data exata no formato AAAA-MM-DD, quando a pessoa perguntar por um dia específico " +
            "(ex.: 'quanto vendi dia 13?' -> use o mês/ano atual). Se vier preenchido, ignora 'period'.",
        },
      },
    },
  },
  {
    name: "get_stock",
    description: "Consulta o estoque disponível de um produto/variação no catálogo.",
    input_schema: {
      type: "object",
      properties: {
        product_text: { type: "string", description: "Nome/descrição do produto." },
        variant_text: { type: "string", description: "Cor e/ou tamanho, se mencionado." },
      },
      required: ["product_text"],
    },
  },
  {
    name: "get_order",
    description: "Busca os detalhes de um pedido específico pelo número (ex.: 'MI-001070' ou só '1070').",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Número do pedido, com ou sem o prefixo MI-." },
      },
      required: ["order_number"],
    },
  },
  {
    name: "get_top_products",
    description:
      "Lista os produtos mais vendidos (por quantidade, somando todas as variações de cada produto) " +
      "num período — opcionalmente filtrando por categoria (roupas/brinquedos/livros).",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "all"], description: "Período (padrão month)." },
        limit: { type: "integer", description: "Quantos itens listar (padrão 5)." },
        category: {
          type: "string",
          enum: ["roupas", "brinquedos", "livros"],
          description: "Filtra só essa categoria — use quando a pessoa perguntar 'e as roupas?' etc.",
        },
      },
    },
  },
];

// --------------------------------------------------------------------------
//  Conversa com o Claude
// --------------------------------------------------------------------------

const SYSTEM_PROMPT = `Você é o assistente interno da miilo, uma lojinha de roupas, brinquedos e livros \
infantis, respondendo por WhatsApp só para os admins da loja (não é atendimento ao cliente).

Regras:
- Respostas curtas e diretas — é WhatsApp, não e-mail. Sem saudação longa nem assinatura.
- Tom informal e direto, em português do Brasil.
- Emojis com moderação: ✅ pra confirmação de venda, 📊 pra números, 🤔 quando não entender.
- Use as ferramentas disponíveis pra QUALQUER pergunta sobre vendas, estoque ou pedidos — nunca \
invente números, produtos ou valores.
- Sempre que uma ferramenta devolver um campo "*_formatted" (já em R$, formato brasileiro), use \
esse valor exatamente como veio — não recalcule nem arredonde.
- Ao responder sobre vendas de um período, cite os pedidos/itens de forma resumida (não precisa \
listar tudo em detalhe) pra que perguntas de acompanhamento na mesma conversa (ex.: "e quais foram \
os itens?", "só teve esse pedido?") possam ser respondidas usando o que você já disse, sem precisar \
repetir a consulta.
- Uma venda pode ter mais de um produto/variação (ex.: cores diferentes do mesmo item, ou produtos \
diferentes) — junte tudo numa única chamada de log_sale (lista de items), gerando um único pedido, \
em vez de chamar log_sale várias vezes.
- Se uma ferramenta (log_sale ou get_stock) vier ambígua (ambiguous_product/ambiguous_variant), \
pergunte de volta em vez de adivinhar — e quando a pessoa responder qual das opções ela quis dizer, \
chame a MESMA ferramenta de novo imediatamente com o produto e a opção escolhida (copie o texto da \
opção exatamente como veio na lista), em vez de repetir a mesma pergunta.
- NUNCA assuma que uma venda já foi paga. Se log_sale voltar "need_payment_choice", pergunte se já \
recebeu (dinheiro/pix/cartão na hora) ou se é pra gerar um link de cobrança pra mandar pro cliente — \
e só chame log_sale de novo (com o campo payment preenchido) depois que a pessoa responder isso. Se \
a resposta trouxer "pay_url", inclua o link na sua confirmação.
- Se a pergunta não tiver nada a ver com a loja (vendas, estoque, pedidos), diga educadamente que só \
ajuda com esses assuntos.
- NUNCA diga que uma venda foi registrada, nem invente um número de pedido, sem ter chamado log_sale \
e recebido ok:true na resposta dessa mesma mensagem — mesmo que a conversa já tenha deixado claro o \
que a pessoa quer. "Confirmar" um pedido de venda sem chamar a ferramenta é o pior erro possível aqui \
(mexe com dinheiro e estoque de verdade).
- Se perguntarem por um dia específico ("quanto vendi dia 13?"), use get_sales_total com o campo \
"date" (AAAA-MM-DD) em vez de "period" — assuma o mês/ano atual quando só o dia for dito.
- Se, depois de um ranking de mais vendidos, perguntarem sobre uma categoria específica ("e as \
roupas?", "e os brinquedos?"), chame get_top_products DE NOVO com o campo "category" — não tente \
adivinhar a partir da lista que você já mostrou (ela pode não ter nenhum item dessa categoria).`;

function systemPromptWithDate(): string {
  return `${SYSTEM_PROMPT}\n\nHoje é ${getBrDateLabel(new Date())} (horário de Brasília).`;
}

async function callClaude(messages: any[]): Promise<any | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        system: systemPromptWithDate(),
        messages,
        tools: TOOLS,
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp-bot] Anthropic respondeu", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[whatsapp-bot] erro ao chamar Claude", err);
    return null;
  }
}

// --------------------------------------------------------------------------
//  Ponto de entrada
// --------------------------------------------------------------------------

const HELP_TEXT =
  'Não entendi 🤔 Manda algo tipo "vendi 1 body canelado azul pra Priscila" ou "quanto vendi hoje?".';

export async function handleWhatsAppMessage(text: string, phone: string): Promise<string> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return HELP_TEXT;
  if (!process.env.ANTHROPIC_API_KEY) return HELP_TEXT;

  const history = await loadHistory(phone);
  const messages: any[] = [...history, { role: "user", content: trimmed }];

  let finalText = HELP_TEXT;
  let saleConfirmed = false;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await callClaude(messages);
    if (!res) break;

    const blocks: any[] = res.content ?? [];
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    const textOut = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (toolUses.length === 0) {
      finalText = textOut || HELP_TEXT;
      break;
    }

    if (textOut) finalText = textOut;
    messages.push({ role: "assistant", content: blocks });

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input);
      if (tu.name === "log_sale" && (result as { ok?: boolean }).ok === true) saleConfirmed = true;
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Trava de segurança: NUNCA deixar passar uma resposta que pareça confirmar
  // uma venda (o "✅" que o prompt reserva pra isso) se log_sale não voltou
  // ok:true de verdade nesse turno — evita o bot "alucinar" um pedido que não
  // existe (já aconteceu: Claude respondeu com confirmação sem chamar a
  // ferramenta nenhuma vez).
  if (finalText.includes("✅") && !saleConfirmed) {
    console.error("[whatsapp-bot] resposta parecia confirmar venda sem log_sale ok:true — bloqueada", {
      phone,
      trimmed,
      finalText,
    });
    finalText =
      "Peraí, não registrei nenhuma venda ainda — deu uma falha aqui do meu lado antes de confirmar. " +
      'Manda de novo, tipo "vendi 1 body canelado azul pra Priscila"?';
  }

  await saveTurns(phone, [
    { role: "user", content: trimmed },
    { role: "assistant", content: finalText },
  ]);

  return finalText;
}
