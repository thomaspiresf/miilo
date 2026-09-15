import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, Product, ProductVariant } from "@/lib/types";

/**
 * Utilitários compartilhados pelos dois bots de WhatsApp (o interno, em
 * lib/whatsapp-bot.ts, e o público, em lib/whatsapp-public-bot.ts): memória
 * de conversa, casamento com o catálogo, busca de pedido por número, e o
 * loop genérico de tool-use com o Claude. Cada bot define seu próprio
 * conjunto de ferramentas e prompt — o que muda entre eles é só o que cada
 * um PODE fazer, não como a conversa funciona por baixo.
 *
 * A memória (tabela whatsapp_conversations) é compartilhada mas isolada por
 * número de telefone — não há risco de um cliente ver contexto do painel
 * interno, já que os números dos admins e dos clientes nunca se cruzam.
 */

export const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const HISTORY_MESSAGES = 12;
const DEFAULT_MAX_TOOL_ITERATIONS = 4;

// --------------------------------------------------------------------------
//  Memória da conversa (por número)
// --------------------------------------------------------------------------

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function loadHistory(phone: string): Promise<ChatTurn[]> {
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

export async function saveTurns(phone: string, turns: ChatTurn[]): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_conversations").insert(turns.map((t) => ({ phone, role: t.role, content: t.content })));
  } catch (err) {
    console.error("[whatsapp] erro ao salvar memória da conversa", err);
  }
}

/**
 * Um admin pode "assumir" uma conversa em /admin/conversas — enquanto
 * pausada, os dois bots continuam registrando a mensagem do cliente (pra
 * aparecer no painel) mas não respondem sozinhos, evitando bot e humano
 * falando ao mesmo tempo.
 */
export async function isBotPaused(phone: string): Promise<boolean> {
  if (!hasSupabaseAdmin()) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("whatsapp_bot_pauses").select("phone").eq("phone", phone).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
//  Status de entrega/leitura (pro painel /admin/conversas mostrar ✓/✓✓)
// --------------------------------------------------------------------------

/**
 * Guarda o wamid (ID que a Meta devolve ao enviar) na resposta do bot que
 * acabou de ser salva pra esse número — quem manda de fato (route.ts) só
 * sabe o wamid DEPOIS de já ter chamado handleWhatsAppMessage/
 * handlePublicMessage, que já salvou a linha. Como não há concorrência real
 * por número (um webhook por vez), pegar a última linha "assistant" ainda
 * sem wamid é seguro.
 */
export async function attachWamid(phone: string, wamid: string): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id")
      .eq("phone", phone)
      .eq("role", "assistant")
      .is("wamid", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await admin.from("whatsapp_conversations").update({ wamid, status: "sent" }).eq("id", data.id);
    }
  } catch (err) {
    console.error("[whatsapp] erro ao anexar wamid", err);
  }
}

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A Cloud API só deixa mandar texto livre (sem template aprovado) dentro da
 * janela de 24h aberta pela ÚLTIMA mensagem que esse número mandou pro bot —
 * fora dela, só mensagem de template. Usado pelo aviso de venda
 * (lib/whatsapp.ts notifySale) pra mandar texto livre quando dá, em vez de
 * depender só do template (que pode ainda não estar aprovado).
 */
export async function hasOpenServiceWindow(phone: string): Promise<boolean> {
  if (!hasSupabaseAdmin()) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("created_at")
      .eq("phone", phone)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return false;
    return Date.now() - new Date(data.created_at).getTime() < SERVICE_WINDOW_MS;
  } catch {
    return false;
  }
}

const VALID_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

/** Chamado pelo webhook quando a Meta manda uma atualização de status (entregue/lida/falhou). */
export async function updateMessageStatus(wamid: string, status: string): Promise<void> {
  if (!hasSupabaseAdmin() || !VALID_STATUSES.has(status)) return;
  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_conversations").update({ status }).eq("wamid", wamid);
  } catch (err) {
    console.error("[whatsapp] erro ao atualizar status da mensagem", err);
  }
}

/**
 * O payload do webhook traz o nome de exibição do WhatsApp de quem mandou a
 * mensagem (contacts[0].profile.name) — não é uma foto (a Cloud API não
 * expõe foto de perfil de terceiros, só o nome), mas dá pra mostrar esse
 * nome no painel em vez de só o número. Guardamos a última versão vista.
 */
export async function upsertContactName(phone: string, name: string | undefined | null): Promise<void> {
  if (!hasSupabaseAdmin() || !name) return;
  try {
    const admin = createAdminClient();
    await admin.from("whatsapp_contacts").upsert({ phone, name, updated_at: new Date().toISOString() });
  } catch (err) {
    console.error("[whatsapp] erro ao salvar nome do contato", err);
  }
}

// --------------------------------------------------------------------------
//  Casamento com o catálogo
// --------------------------------------------------------------------------

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function variantLabel(v: ProductVariant): string {
  return [v.size, v.color].filter(Boolean).join(" · ");
}

export type MatchResult =
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

export function matchProduct(products: Product[], productText: string, variantText?: string): MatchResult {
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

export function matchOrderByNumber(orders: Order[], numberText: string): Order | undefined {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const q = clean(numberText);
  if (!q) return undefined;
  return orders.find((o) => clean(o.number) === q) ?? orders.find((o) => clean(o.number).endsWith(q));
}

// --------------------------------------------------------------------------
//  Loop de tool-use genérico com o Claude
// --------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ToolCallRecord = { name: string; input: any; result: any };

// Modelos (mesmo com instrução explícita no prompt) às vezes "inventam" uma
// URL plausível em vez de copiar o link real devolvido pela ferramenta — já
// aconteceu (ex.: "/products/body-canelado" e até o domínio errado). Em vez
// de confiar que o texto final tem o link certo, o prompt instrui o Claude a
// escrever o token [[LINK]] no lugar do link, e o código troca aqui pelo
// link de verdade que a ferramenta devolveu nesse turno — assim o link que
// chega no WhatsApp nunca passou pela "criatividade" do modelo.
export function fillLinkPlaceholders(text: string, calls: ToolCallRecord[], fallbackUrl: string): string {
  const urls: string[] = [];
  for (const c of calls) {
    const r = c.result as Record<string, unknown>;
    const u = typeof r?.url === "string" ? r.url : typeof r?.pay_url === "string" ? r.pay_url : null;
    if (u) urls.push(u);
  }
  let i = 0;
  return text.replace(/\[\[LINK\]\]/g, () => urls[i++] ?? fallbackUrl);
}

/**
 * O Claude escreve negrito em markdown padrão (**assim**), mas o WhatsApp só
 * reconhece *um* asterisco de cada lado — o resultado é o "**" aparecendo
 * literal na mensagem, e pior, quando cola direto num link (**link**) o
 * WhatsApp para de reconhecer a URL como link clicável. Aplique sempre no
 * texto final, depois de fillLinkPlaceholders.
 */
export function sanitizeWhatsAppFormatting(text: string): string {
  let out = text.replace(/\*\*/g, "*");
  // Garante que nenhum asterisco fique colado numa URL, mesmo que tenha
  // sobrado um único depois da troca acima.
  out = out.replace(/\*+(https?:\/\/\S+?)\*+/g, "$1");
  return out;
}

export async function runToolLoop(opts: {
  messages: any[];
  systemPrompt: string;
  tools: any[];
  executeTool: (name: string, input: any) => Promise<object>;
  maxIterations?: number;
}): Promise<{ finalText: string | null; calls: ToolCallRecord[] }> {
  const { messages, systemPrompt, tools, executeTool } = opts;
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  const calls: ToolCallRecord[] = [];
  let finalText: string | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const res = await callClaude(messages, systemPrompt, tools);
    if (!res) break;

    const blocks: any[] = res.content ?? [];
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    const textOut = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (toolUses.length === 0) {
      finalText = textOut || null;
      break;
    }

    if (textOut) finalText = textOut;
    messages.push({ role: "assistant", content: blocks });

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input);
      calls.push({ name: tu.name, input: tu.input, result });
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { finalText, calls };
}

async function callClaude(messages: any[], systemPrompt: string, tools: any[]): Promise<any | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 500, system: systemPrompt, messages, tools }),
    });
    if (!res.ok) {
      console.error("[whatsapp] Anthropic respondeu", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[whatsapp] erro ao chamar Claude", err);
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
