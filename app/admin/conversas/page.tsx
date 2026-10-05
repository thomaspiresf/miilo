import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listConversationThreads } from "@/lib/data/whatsapp-conversations";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL, formatDateTime, formatWhatsAppPhone } from "@/lib/format";
import { isReceivable, toReceivable } from "@/lib/receivables";
import { ContactAvatar } from "@/components/admin/contact-avatar";
import { ReceivablesPanel } from "@/components/admin/receivables-panel";
import { cn } from "@/lib/utils";

export default async function ConversasPage(props: PageProps<"/admin/conversas">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tab = sp.aba === "cobrancas" ? "cobrancas" : "conversas";

  const [threads, orders] = await Promise.all([listConversationThreads(), listAllOrders()]);
  // mais antigas primeiro: são as que mais precisam de cobrança
  const receivables = orders
    .filter(isReceivable)
    .map(toReceivable)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const receivableTotal = receivables.reduce((s, r) => s + r.total, 0);
  const overdueCount = receivables.filter((r) => r.overdue).length;

  const tabs = [
    { id: "conversas", label: "Conversas", href: "/admin/conversas", count: null as number | null },
    { id: "cobrancas", label: "Cobranças", href: "/admin/conversas?aba=cobrancas", count: receivables.length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Conversas do WhatsApp</h1>
        <p className="text-sm text-muted">
          Acompanhe as conversas do bot (interno e de atendimento ao público), intervenha quando precisar e cobre quem
          ainda não pagou.
        </p>
      </div>

      <div role="tablist" className="inline-flex rounded-full border border-border bg-black/[0.03] p-0.5 text-sm">
        {tabs.map((t) => (
          <Link
            prefetch={false}
            key={t.id}
            href={t.href}
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 font-medium transition",
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold",
                  overdueCount > 0 ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "cobrancas" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted">
              Total a receber
              {overdueCount > 0 && (
                <span className="ml-2 text-danger">
                  · {overdueCount} atrasada{overdueCount === 1 ? "" : "s"} (mais de 7 dias)
                </span>
              )}
            </span>
            <span className="font-black">{formatBRL(receivableTotal)}</span>
          </div>
          <ReceivablesPanel items={receivables} />
        </div>
      )}

      {tab === "conversas" && (
        <>

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
              <Link prefetch={false}
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
        </>
      )}
    </div>
  );
}
