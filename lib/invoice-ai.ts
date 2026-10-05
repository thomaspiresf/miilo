import "server-only";
import { sanitizeScan, type ScannedItem } from "@/lib/invoice-types";

/**
 * Lê a foto (ou PDF) de uma nota de compra de mercadoria e devolve os itens: nome, quantidade e
 * custo unitário. Usa visão do Claude com saída estruturada. Devolve null se não há chave da IA
 * ou se a leitura falhar — a tela cai pro cadastro manual.
 */

const MODEL = "claude-sonnet-5";

const PROMPT = `Você lê notas fiscais, pedidos e romaneios de COMPRA de mercadoria de uma loja infantil brasileira (roupas, brinquedos e livros), geralmente de atacado (Brás/SP), e lista os itens comprados.

Regras:
- Um item por linha de produto da nota. Ignore frete, impostos, desconto geral, subtotal, total e linhas de pagamento.
- name: nome do produto em português, limpo e legível (expanda abreviações óbvias como "MC"→"manga curta", "BR"→"branco" só quando tiver certeza; nunca invente características). Sem código de fornecedor no nome.
- quantity: unidades compradas (inteiro). Se a nota vende em pacote/kit/dúzia, use a quantidade de PEÇAS quando estiver clara; senão a quantidade da linha.
- unit_cost: quanto custou CADA unidade, em reais, número com ponto decimal (ex.: 29.9). Se a nota só traz o total da linha, divida pela quantidade. Valores brasileiros vêm como "R$ 1.234,56".
- size e color: só se aparecerem na linha (ex.: "RN", "P", "M", "2 anos", "azul"); senão null.
- kind: roupas, brinquedos ou livros pelo tipo do produto; null se não der pra saber.
- code: código/referência do fornecedor se houver.
- supplier: nome do fornecedor/loja emissora. invoice_date: data de emissão AAAA-MM-DD (datas brasileiras são dia/mês/ano).
- is_invoice: false se a imagem não for uma nota/pedido legível. Se não conseguir ler um valor com segurança, pule o item. Nunca invente.`;

const TOOL = {
  name: "registrar_itens",
  description: "Registra os itens lidos da nota.",
  input_schema: {
    type: "object",
    properties: {
      is_invoice: { type: "boolean" },
      supplier: { type: ["string", "null"] },
      invoice_date: { type: ["string", "null"], description: "AAAA-MM-DD" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "integer" },
            unit_cost: { type: "number" },
            size: { type: ["string", "null"] },
            color: { type: ["string", "null"] },
            kind: { type: ["string", "null"], enum: ["roupas", "brinquedos", "livros", null] },
            code: { type: ["string", "null"] },
          },
          required: ["name", "quantity", "unit_cost", "size", "color", "kind", "code"],
        },
      },
    },
    required: ["is_invoice", "supplier", "invoice_date", "items"],
  },
};

export type InvoiceScan = { items: ScannedItem[]; supplier: string | null; invoiceDate: string | null };

export function invoiceAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function scanInvoice(bytes: Buffer, mediaType: string): Promise<InvoiceScan | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const source = { type: "base64", media_type: mediaType, data: bytes.toString("base64") };
  const file =
    mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };
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
        max_tokens: 6000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [file, { type: "text", text: PROMPT }] }],
      }),
    });
    if (!res.ok) {
      console.error("[invoice-ai] Anthropic respondeu", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const block = (data?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    return sanitizeScan(block?.input);
  } catch (err) {
    console.error("[invoice-ai] erro ao ler a nota", err);
    return null;
  }
}
