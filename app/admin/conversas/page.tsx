import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listConversationThreads } from "@/lib/data/whatsapp-conversations";
import { formatDateTime, formatWhatsAppPhone } from "@/lib/format";
import { ContactAvatar } from "@/components/admin/contact-avatar";

export default async function ConversasPage() {
  await requireAdmin();
  const threads = await listConversationThreads();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Conversas do WhatsApp</h1>
        <p className="text-sm text-muted">
          Acompanhe as conversas do bot (interno e de atendimento ao público) e intervenha quando precisar.
        </p>
      </div>

      {threads.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhuma conversa ainda. (Se acabou de configurar, rode as migrações
          supabase/migration-whatsapp-memory.sql e
          supabase/migration-whatsapp-conversations-admin.sql no SQL Editor.)
        </p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {threads.map((t) => (
            <li key={t.phone}>
              <Link
                href={`/admin/conversas/${t.phone}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]"
              >
                <ContactAvatar name={t.contactName} phone={t.phone} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{t.contactName || formatWhatsAppPhone(t.phone)}</span>
                    {t.paused && (
                      <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                        Bot pausado
                      </span>
                    )}
                  </p>
                  {t.contactName && <p className="text-xs text-muted">{formatWhatsAppPhone(t.phone)}</p>}
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {t.lastRole === "assistant" ? "Você: " : ""}
                    {t.lastMessage}
                  </p>
                </div>
                <span className="shrink-0 self-start text-xs text-muted">{formatDateTime(t.lastAt)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
