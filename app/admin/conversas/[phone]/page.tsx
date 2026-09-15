import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getConversationMessages, isConversationPaused } from "@/lib/data/whatsapp-conversations";
import { ConversationThread } from "@/components/admin/conversation-thread";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  await requireAdmin();
  const { phone } = await params;

  const [messages, paused] = await Promise.all([getConversationMessages(phone), isConversationPaused(phone)]);
  if (messages.length === 0) notFound();

  return <ConversationThread phone={phone} initialMessages={messages} initialPaused={paused} />;
}
