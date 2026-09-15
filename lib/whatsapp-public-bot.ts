import "server-only";
import { formatBRL } from "@/lib/format";
import { site } from "@/lib/site";
import { notifyNumbers, sendWhatsAppText } from "@/lib/whatsapp";
import { listProducts } from "@/lib/data/catalog";
import { listAllOrders } from "@/lib/data/orders";
import {
  loadHistory,
  saveTurns,
  normalize,
  variantLabel,
  matchProduct,
  matchOrderByNumber,
  runToolLoop,
} from "@/lib/whatsapp-shared";

/**
 * Bot de atendimento por WhatsApp pro PÚBLICO (quem não está em
 * WHATSAPP_NOTIFY_NUMBERS) — o oposto do bot interno em termos de segurança:
 * ali a regra é "não responde ninguém fora da lista", aqui é "responde
 * qualquer um, mas só com o que é seguro expor". Nunca deve ter acesso a
 * log_sale, get_sales_total, get_top_products ou estoque exato — só preço,
 * disponibilidade (sem número), status do PRÓPRIO pedido (com verificação de
 * identidade) e um jeito de chamar um humano.
 *
 * Reaproveita do bot interno só o que é puramente mecânico e seguro
 * (casamento com o catálogo, busca de pedido por número, memória de
 * conversa, loop de tool-use) — tudo isolado em lib/whatsapp-shared.ts.
 */

const MAX_MESSAGE_LENGTH = 500;

// Quantas unidades ou menos já mostra como "últimas unidades" em vez de só
// "disponível" — nunca o número exato.
const LOW_STOCK_THRESHOLD = 2;

function availabilityLabel(stock: number): string {
  if (stock <= 0) return "indisponível no momento";
  if (stock <= LOW_STOCK_THRESHOLD) return "últimas unidades";
  return "disponível";
}

// --------------------------------------------------------------------------
//  Ferramentas
// --------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

async function toolGetProductInfo(input: any): Promise<object> {
  const productText = typeof input.product_text === "string" ? input.product_text : "";
  if (!productText) return { found: false, reason: "missing_product" };
  const variantText = typeof input.variant_text === "string" ? input.variant_text : undefined;

  const products = await listProducts({});
  const match = matchProduct(products, productText, variantText);

  if (match.type === "none") return { found: false, reason: "not_found", query: productText };
  if (match.type === "ambiguous_product") return { found: false, reason: "ambiguous_product", options: match.names };
  if (match.type === "ambiguous_variant") {
    return {
      found: true,
      product_name: match.product.name,
      price_formatted: formatBRL(match.product.price_from),
      url: `${site.url}/p/${match.product.slug}`,
      variants: match.product.variants
        .filter((v) => v.active)
        .map((v) => ({ variant_label: variantLabel(v) || "Único", availability: availabilityLabel(v.stock) })),
    };
  }

  const { product, variant } = match;
  return {
    found: true,
    product_name: product.name,
    variant_label: variantLabel(variant) || null,
    price_formatted: formatBRL(variant.price),
    availability: availabilityLabel(variant.stock),
    url: `${site.url}/p/${product.slug}`,
  };
}

async function toolGetOrderStatus(input: any): Promise<object> {
  const orderNumber = typeof input.order_number === "string" ? input.order_number : "";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  if (!orderNumber || !contact) return { found: false, reason: "missing_info" };

  const orders = await listAllOrders();
  const order = matchOrderByNumber(orders, orderNumber);
  // Mesma mensagem genérica em qualquer caso de não-match, pra não dar pista
  // se um número de pedido existe ou não pra quem não é o dono dele.
  if (!order) return { found: false, reason: "not_found" };

  const emailMatch = Boolean(order.email) && normalize(order.email) === normalize(contact);
  const digits = (s: string) => s.replace(/\D/g, "");
  const contactDigits = digits(contact);
  const phoneMatch = Boolean(order.phone) && contactDigits.length >= 8 && digits(order.phone!).endsWith(contactDigits);

  if (!emailMatch && !phoneMatch) return { found: false, reason: "not_found" };

  return {
    found: true,
    number: order.number,
    status: order.status,
    created_at: order.created_at,
    total_formatted: formatBRL(order.total),
    items: order.items.map((it) => ({ product_name: it.product_name, variant_label: it.variant_label, qty: it.qty })),
  };
}

async function toolEscalateToHuman(input: any, phone: string): Promise<object> {
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "não especificado";
  const numbers = notifyNumbers();
  const message = `🙋 Cliente pediu atendimento humano (${phone}):\n${reason}`;
  await Promise.all(numbers.map((to) => sendWhatsAppText(to, message)));
  return { ok: true };
}

async function executeTool(name: string, input: any, phone: string): Promise<object> {
  switch (name) {
    case "get_product_info":
      return toolGetProductInfo(input ?? {});
    case "get_order_status":
      return toolGetOrderStatus(input ?? {});
    case "escalate_to_human":
      return toolEscalateToHuman(input ?? {}, phone);
    default:
      return { error: "unknown_tool" };
  }
}

const TOOLS = [
  {
    name: "get_product_info",
    description: "Consulta preço e disponibilidade (sem número exato de estoque) de um produto do catálogo.",
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
    name: "get_order_status",
    description:
      "Consulta o status de um pedido específico. Exige o número do pedido E um contato (e-mail ou " +
      "telefone usado na compra) pra confirmar que quem está perguntando é o dono do pedido.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Número do pedido, ex.: 'MI-001070'." },
        contact: { type: "string", description: "E-mail ou telefone usado na compra." },
      },
      required: ["order_number", "contact"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Avisa a equipe da loja que esse cliente precisa de atendimento humano.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motivo resumido, ex.: 'reclamação de produto com defeito'." },
      },
      required: ["reason"],
    },
  },
];

// --------------------------------------------------------------------------
//  Conversa com o Claude
// --------------------------------------------------------------------------

const SYSTEM_PROMPT = `Você é o atendimento por WhatsApp da miilo, uma lojinha de roupas, brinquedos \
e livros infantis. Quem fala com você é cliente ou visitante — isto NÃO é o painel interno da loja.

Informações da loja (use exatamente estas, nunca invente outras):
- Retirada: ${site.storeAddress}
- Horário de retirada: segunda a sexta, das 9h às 18h. Não abre sábado nem domingo.
- Pagamento: Pix e cartão de crédito/débito, pelo site (Mercado Pago).
- Entrega: por enquanto só retirada na loja — ainda não entregamos pelo Correios/motoboy.
- Trocas e devoluções: até 7 dias corridos após a compra, produto sem uso e com a etiqueta.

Regras:
- Respostas curtas, simpáticas e diretas — é WhatsApp. Tom acolhedor de loja infantil, em português \
do Brasil.
- Use get_product_info pra QUALQUER pergunta sobre produto, preço ou disponibilidade — nunca invente \
preço, cor, tamanho ou se tem em estoque.
- Pode informar o preço exato (campo "*_formatted"). NUNCA informe quantidade exata em estoque — só \
o que a ferramenta já devolve em "availability" ("disponível", "últimas unidades" ou "indisponível \
no momento").
- Pra consultar status de pedido, SEMPRE peça o número do pedido E o e-mail ou telefone usado na \
compra antes de chamar get_order_status — nunca chame com só uma das duas informações. Se vier \
found:false, responda de forma genérica ("não encontrei com esses dados, confere se está certo") — \
nunca dê mais detalhe do que isso, pra não revelar se um número de pedido existe.
- Nunca revele dados de outro cliente, nem qualquer informação interna da loja (vendas, faturamento, \
estoque exato, ferramentas administrativas, se existe um painel ou bot interno). Se perguntarem algo \
assim, diga que não tem essa informação disponível por aqui.
- Se perguntarem se você é um robô/IA, admita que sim.
- Nunca prometa prazo de entrega, desconto, parcelamento ou qualquer condição que não esteja nas \
informações da loja acima.
- Reclamação, produto com defeito, pedido de reembolso, ou se a pessoa pedir explicitamente pra \
falar com alguém: chame escalate_to_human e avise que a equipe vai entrar em contato — não tente \
resolver sozinho.
- Se a pergunta não tiver nada a ver com a miilo, responda educadamente que só ajuda com assuntos da \
loja.`;

// --------------------------------------------------------------------------
//  Ponto de entrada
// --------------------------------------------------------------------------

const HELP_TEXT = "Oi! 😊 Posso ajudar com produtos, preços, disponibilidade e status de pedidos da miilo.";

export async function handlePublicMessage(text: string, phone: string): Promise<string> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return HELP_TEXT;
  if (!process.env.ANTHROPIC_API_KEY) return HELP_TEXT;

  const history = await loadHistory(phone);
  const { finalText } = await runToolLoop({
    messages: [...history, { role: "user", content: trimmed }],
    systemPrompt: SYSTEM_PROMPT,
    tools: TOOLS,
    executeTool: (name, input) => executeTool(name, input, phone),
  });

  const reply = finalText ?? HELP_TEXT;

  await saveTurns(phone, [
    { role: "user", content: trimmed },
    { role: "assistant", content: reply },
  ]);

  return reply;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
