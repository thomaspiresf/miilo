import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Camada de dados pro painel /admin/conversas — ler o histórico salvo pelos
 * bots (lib/whatsapp-bot.ts / lib/whatsapp-public-bot.ts, tabela
 * whatsapp_conversations) e permitir que um admin responda manualmente,
 * pausando o bot naquela conversa (tabela whatsapp_bot_pauses) pra evitar
 * bot e humano respondendo ao mesmo tempo.
 */

export type MessageStatus = "sent" | "delivered" | "read" | "failed" | null;

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sender: "bot" | "human" | null;
  actor_name: string | null;
  status: MessageStatus;
  created_at: string;
};

export type ConversationSummary = {
  phone: string;
  contactName: string | null;
  lastMessage: string;
  lastRole: "user" | "assistant";
  lastAt: string;
  messageCount: number;
  paused: boolean;
};

// Janela de mensagens recentes usada pra montar a lista de conversas — mais
// que suficiente pra descobrir os números ativos sem varrer a tabela toda.
const RECENT_WINDOW = 1000;

export async function listConversationThreads(): Promise<ConversationSummary[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_conversations")
    .select("phone, role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);
  if (error || !data) return [];

  const byPhone = new Map<string, ConversationSummary>();
  for (const row of data as { phone: string; role: "user" | "assistant"; content: string; created_at: string }[]) {
    const existing = byPhone.get(row.phone);
    if (!existing) {
      byPhone.set(row.phone, {
        phone: row.phone,
        contactName: null,
        lastMessage: row.content,
        lastRole: row.role,
        lastAt: row.created_at,
        messageCount: 1,
        paused: false,
      });
    } else {
      existing.messageCount += 1;
    }
  }

  const [{ data: pauses }, { data: contacts }] = await Promise.all([
    admin.from("whatsapp_bot_pauses").select("phone"),
    admin.from("whatsapp_contacts").select("phone, name").in("phone", [...byPhone.keys()]),
  ]);
  const pausedSet = new Set((pauses ?? []).map((p) => p.phone as string));
  const nameByPhone = new Map((contacts ?? []).map((c) => [c.phone as string, c.name as string | null]));
  for (const thread of byPhone.values()) {
    thread.paused = pausedSet.has(thread.phone);
    thread.contactName = nameByPhone.get(thread.phone) ?? null;
  }

  return [...byPhone.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export async function getConversationMessages(phone: string): Promise<ConversationMessage[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_conversations")
    .select("id, role, content, sender, actor_name, status, created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return data as ConversationMessage[];
}

/** Nome de exibição do WhatsApp da pessoa (visto no webhook), se já tiver chegado alguma mensagem dela. */
export async function getContactName(phone: string): Promise<string | null> {
  if (!hasSupabaseAdmin()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_contacts").select("name").eq("phone", phone).maybeSingle();
  return data?.name ?? null;
}

export async function isConversationPaused(phone: string): Promise<boolean> {
  if (!hasSupabaseAdmin()) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_bot_pauses").select("phone").eq("phone", phone).maybeSingle();
  return Boolean(data);
}

export async function pauseConversation(phone: string, actorEmail?: string | null): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  const admin = createAdminClient();
  await admin
    .from("whatsapp_bot_pauses")
    .upsert({ phone, paused_by: actorEmail ?? null, paused_at: new Date().toISOString() });
}

export async function resumeConversation(phone: string): Promise<void> {
  if (!hasSupabaseAdmin()) return;
  const admin = createAdminClient();
  await admin.from("whatsapp_bot_pauses").delete().eq("phone", phone);
}

/** Manda a mensagem de verdade pro WhatsApp, registra na conversa e pausa o bot ali. */
export async function sendManualReply(
  phone: string,
  text: string,
  actor?: { email: string; name: string | null },
): Promise<{ ok: boolean }> {
  if (!hasSupabaseAdmin()) return { ok: false };
  const sent = await sendWhatsAppText(phone, text);
  if (!sent.ok) return { ok: false };
  const admin = createAdminClient();
  await admin.from("whatsapp_conversations").insert({
    phone,
    role: "assistant",
    content: text,
    sender: "human",
    actor_name: actor?.name || actor?.email || null,
    wamid: sent.id,
    status: sent.id ? "sent" : null,
  });
  await pauseConversation(phone, actor?.email);
  return { ok: true };
}
