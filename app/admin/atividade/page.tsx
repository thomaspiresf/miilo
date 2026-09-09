import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAuditLog, listAuditActors } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/format";
import { AuditFilters } from "@/components/admin/audit-filters";

const ENTITY_HREF: Record<string, (id: string) => string> = {
  product: (id) => `/admin/produtos/${id}`,
  order: (id) => `/admin/pedidos/${id}`,
};

function actionColor(action: string) {
  if (action.includes("delete") || action.includes("discard")) return "bg-danger";
  if (action.includes("create") || action.includes("sale")) return "bg-success";
  return "bg-accent";
}

export default async function AuditLogPage(props: PageProps<"/admin/atividade">) {
  await requireAdmin();
  const sp = await props.searchParams;

  const actor = typeof sp.actor === "string" ? sp.actor : undefined;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const limit = Math.min(Number(sp.limit) || 80, 500);

  const [entries, actors] = await Promise.all([
    listAuditLog({ actor, action: cat, limit }),
    listAuditActors(),
  ]);

  const nextParams = new URLSearchParams();
  if (actor) nextParams.set("actor", actor);
  if (cat) nextParams.set("cat", cat);
  nextParams.set("limit", String(limit + 80));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Atividade</h1>
        <p className="text-sm text-muted">
          Toda ação feita no painel fica registrada aqui, com quem fez.
        </p>
      </div>

      <AuditFilters actors={actors} />

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {actors.length === 0
            ? "Nenhuma atividade registrada ainda. (Se acabou de configurar, rode supabase/migration-audit-log.sql no SQL Editor.)"
            : "Nada com esses filtros."}
        </p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {entries.map((e) => {
            const href =
              e.entity && e.entity_id && ENTITY_HREF[e.entity]
                ? ENTITY_HREF[e.entity](e.entity_id)
                : null;
            const body = (
              <div className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionColor(e.action)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{e.summary}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-semibold text-foreground/70">
                      {e.actor_name || e.actor_email || "—"}
                    </span>
                    {e.actor_name && e.actor_email ? ` · ${e.actor_email}` : ""} ·{" "}
                    {formatDateTime(e.created_at)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={e.id}>
                {href ? (
                  <Link href={href} className="block hover:bg-black/[0.02]">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      )}

      {entries.length >= limit && (
        <div className="text-center">
          <Link
            href={`/admin/atividade?${nextParams.toString()}`}
            className="text-sm font-semibold text-primary"
          >
            Carregar mais
          </Link>
        </div>
      )}
    </div>
  );
}
