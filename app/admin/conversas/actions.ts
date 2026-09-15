"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, currentActor } from "@/lib/auth";
import { logAction } from "@/lib/data/audit";
import { sendManualReply, pauseConversation, resumeConversation } from "@/lib/data/whatsapp-conversations";

export async function sendManualReplyAction(
  phone: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Mensagem vazia." };

  const actor = await currentActor();
  const result = await sendManualReply(phone, trimmed, actor.email);
  if (!result.ok) {
    return { ok: false, error: "Não consegui enviar — confere se as credenciais do WhatsApp estão ok." };
  }

  await logAction({ action: "whatsapp.manual_reply", summary: `Resposta manual no WhatsApp pra ${phone}` });
  revalidatePath(`/admin/conversas/${phone}`);
  revalidatePath("/admin/conversas");
  return { ok: true };
}

export async function pauseConversationAction(phone: string): Promise<void> {
  await requireAdmin();
  const actor = await currentActor();
  await pauseConversation(phone, actor.email);
  revalidatePath(`/admin/conversas/${phone}`);
  revalidatePath("/admin/conversas");
}

export async function resumeConversationAction(phone: string): Promise<void> {
  await requireAdmin();
  await resumeConversation(phone);
  revalidatePath(`/admin/conversas/${phone}`);
  revalidatePath("/admin/conversas");
}
