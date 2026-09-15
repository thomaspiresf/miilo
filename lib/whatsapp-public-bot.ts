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
  fillLinkPlaceholders,
  sanitizeWhatsAppFormatting,
  isBotPaused,
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

const SYSTEM_PROMPT = `Você troca mensagens de WhatsApp em nome da miilo, uma marca de roupas, \
brinquedos e livros infantis que vende pelo site. Quem fala com você é cliente ou visitante — isto \
NÃO é o painel interno, é atendimento de verdade.

Informações (use exatamente estas, nunca invente outras):
- A miilo não tem loja física pra visitar — vende só pelo site (${site.url}). O que existe é um \
ponto de retirada dos pedidos, no Instituto Vivar (${site.storeAddress}), de segunda a sexta, 9h às \
18h (não abre sábado nem domingo). NUNCA convide alguém pra "vir na loja" — não existe loja, só esse \
ponto de retirada pra quem já comprou.
- Pagamento: Pix e cartão de crédito/débito, direto no site (Mercado Pago).
- Entrega em casa ainda não está disponível — só retirada, por enquanto.
- Trocas e devoluções: até 7 dias corridos após a compra, produto sem uso e com a etiqueta.

Como escrever:
- Escreva como uma pessoa de verdade mandando mensagem, não como um script de atendimento. Frases \
curtas, naturais, com a informalidade normal de WhatsApp (pode usar "vc", contrações, etc. com \
moderação) — nada de linguagem robótica, repetir a pergunta antes de responder, ou soar como um menu \
de opções.
- Nunca liste campos técnicos como se fossem a resposta (não diga "availability: disponível" — diga \
"tem sim!" ou "só restam poucas unidades, se quiser"). Traduza sempre pra uma frase normal.
- Emojis com moderação, só quando fizer sentido — não em toda mensagem.
- Negrito no WhatsApp é com *um* asterisco de cada lado, nunca **dois**. E nunca cole asterisco ou \
qualquer símbolo direto numa URL — isso quebra o link.
- Se alguém quiser ver o catálogo, um produto específico, cores/tamanhos, ou "dar uma olhada": manda \
o link. IMPORTANTE: nunca escreva a URL você mesmo (nem de memória, nem "adivinhando" o formato) — \
escreva exatamente o token [[LINK]] no lugar onde o link deveria aparecer, tipo "Dá uma olhada aqui: \
[[LINK]]". O sistema troca automaticamente por um link real e correto depois.
- Use get_product_info pra QUALQUER pergunta sobre produto, preço ou disponibilidade — nunca invente \
preço, cor, tamanho ou se tem em estoque.
- Pode informar o preço exato (campo "*_formatted"). NUNCA informe quantidade exata em estoque — só \
o que a ferramenta já devolve em "availability", numa frase natural.
- Pra consultar status de pedido, sempre peça o número do pedido E o e-mail ou telefone usado na \
compra antes de chamar get_order_status — nunca chame com só uma das duas informações. Se vier \
found:false, responda de forma genérica ("não encontrei com esses dados, confere se está certo") — \
nunca dê mais detalhe do que isso, pra não revelar se um número de pedido existe.
- Nunca revele dados de outro cliente, nem qualquer informação interna da loja (vendas, faturamento, \
estoque exato, ferramentas administrativas, se existe um painel ou bot interno). Se perguntarem algo \
assim, diga que não tem essa informação disponível por aqui.
- Se perguntarem se você é um robô/IA, admita que sim, sem drama.
- Nunca prometa prazo de entrega, desconto, parcelamento ou qualquer condição que não esteja nas \
informações acima.
- Reclamação, produto com defeito, pedido de reembolso, ou se a pessoa pedir explicitamente pra \
falar com alguém: chame escalate_to_human e avise que a equipe vai entrar em contato — não tente \
resolver sozinho.
- Se a pergunta não tiver nada a ver com a miilo, responda educadamente que só ajuda com assuntos da \
loja.`;

// --------------------------------------------------------------------------
//  Ponto de entrada
// --------------------------------------------------------------------------

const HELP_TEXT = "Oi! 😊 Me conta o que você procura que eu te ajudo — produto, preço ou seu pedido.";

export async function handlePublicMessage(text: string, phone: string): Promise<string | null> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return HELP_TEXT;

  // Admin assumiu essa conversa em /admin/conversas — só registra a
  // mensagem (pra aparecer no painel) e não responde por cima.
  if (await isBotPaused(phone)) {
    await saveTurns(phone, [{ role: "user", content: trimmed }]);
    return null;
  }

  if (!process.env.ANTHROPIC_API_KEY) return HELP_TEXT;

  const history = await loadHistory(phone);
  const { finalText, calls } = await runToolLoop({
    messages: [...history, { role: "user", content: trimmed }],
    systemPrompt: SYSTEM_PROMPT,
    tools: TOOLS,
    executeTool: (name, input) => executeTool(name, input, phone),
  });

  const reply = sanitizeWhatsAppFormatting(fillLinkPlaceholders(finalText ?? HELP_TEXT, calls, site.url));

  await saveTurns(phone, [
    { role: "user", content: trimmed },
    { role: "assistant", content: reply },
  ]);

  return reply;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
