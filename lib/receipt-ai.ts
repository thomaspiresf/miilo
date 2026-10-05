import "server-only";
import { EXPENSE_CATEGORIES, EXPENSE_ITEM_TYPES, type ExpenseCategory, type ExpenseItemType } from "@/lib/expenses";

/**
 * Lê a foto de uma nota/cupom/comprovante e devolve os campos de um gasto.
 * Usa visão do Claude com uma ferramenta de saída estruturada (nada de texto
 * livre pra interpretar). Sempre devolve null em caso de falha — quem chama
 * trata como "preencha na mão"; a imagem é salva de qualquer jeito.
 */

const MODEL = "claude-sonnet-5";

export type ReceiptScan = {
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  merchant: string | null;
  description: string | null;
  category: ExpenseCategory | null;
  itemType: ExpenseItemType | null;
};

const PROMPT = `Você lê fotos de notas fiscais, cupons, comprovantes e recibos de uma loja infantil brasileira (miilo) e extrai os dados do gasto.

Regras:
- amount: o valor TOTAL efetivamente pago, em reais, como número com ponto decimal (ex.: 1234.56). Se houver subtotal, desconto, troco ou parcelas, use o total final pago. Valores brasileiros vêm como "R$ 1.234,56".
- date: data da compra/emissão no formato AAAA-MM-DD (datas brasileiras são dia/mês/ano).
- merchant: nome do estabelecimento ou fornecedor.
- description: descrição curta do gasto (ex.: "Compra Brás - bodies", "Internet", "Embalagens").
- category: mercadoria (compra de produtos para revender/estoque), fixa (aluguel, internet, luz, assinaturas, contador, hospedagem), marketing (anúncios, impulsionamento, gráfica, brindes) ou outros (embalagens, frete, taxas e o resto).
- item_type: o que foi comprado — brinquedo (brinquedos, pelúcias, jogos), roupa (roupas, calçados, acessórios de vestir), sacolas (aqui é o tipo "Embalagem": sacolas, embalagens, caixas, fitas, papel de seda) ou outros. Use null se não for compra de mercadoria/insumo ou não der pra saber.
- is_receipt: false se a imagem não for uma nota/comprovante legível.
- Se não conseguir ler algum campo com segurança, use null. Nunca invente valores.`;

const TOOL = {
  name: "registrar_nota",
  description: "Registra os dados lidos da nota.",
  input_schema: {
    type: "object",
    properties: {
      is_receipt: { type: "boolean" },
      amount: { type: ["number", "null"] },
      date: { type: ["string", "null"], description: "AAAA-MM-DD" },
      merchant: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      category: { type: ["string", "null"], enum: [...EXPENSE_CATEGORIES, null] },
      item_type: { type: ["string", "null"], enum: [...EXPENSE_ITEM_TYPES, null] },
    },
    required: ["is_receipt", "amount", "date", "merchant", "description", "category", "item_type"],
  },
};

/** Valida/normaliza o que o modelo devolveu — nunca confia no formato. */
export function sanitizeScan(input: unknown): ReceiptScan | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (r.is_receipt === false) return null;

  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? Math.round(r.amount * 100) / 100 : null;
  const date =
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !Number.isNaN(Date.parse(r.date)) ? r.date : null;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(r.category as string)
    ? (r.category as ExpenseCategory)
    : null;

  const itemType = (EXPENSE_ITEM_TYPES as readonly string[]).includes(r.item_type as string)
    ? (r.item_type as ExpenseItemType)
    : null;

  const scan: ReceiptScan = {
    amount,
    date,
    merchant: str(r.merchant, 120),
    description: str(r.description, 160),
    category,
    itemType,
  };
  return scan.amount == null && !scan.date && !scan.merchant && !scan.description ? null : scan;
}

export async function scanReceipt(bytes: Buffer, mediaType: string): Promise<ReceiptScan | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[receipt-ai] Anthropic respondeu", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const block = (data?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    return sanitizeScan(block?.input);
  } catch (err) {
    console.error("[receipt-ai] erro ao ler a nota", err);
    return null;
  }
}
