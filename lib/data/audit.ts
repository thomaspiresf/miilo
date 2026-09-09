import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { currentActor } from "@/lib/auth";

export type AuditEntity =
  | "product"
  | "variant"
  | "category"
  | "coupon"
  | "order"
  | "user"
  | "settings";

export type AuditInput = {
  action: string;
  entity?: AuditEntity;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown> | null;
};

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const MISSING = /relation .* does not exist|could not find the table|schema cache/i;

/**
 * Registra uma ação do admin. NUNCA lança — falha de log não pode quebrar
 * a ação em si.
 */
export async function logAction(input: AuditInput): Promise<void> {
  try {
    if (!hasSupabaseAdmin()) return; // modo demonstração: não registra
    const actor = await currentActor();
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      actor_email: actor.email,
      actor_name: actor.name,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      meta: input.meta ?? null,
    });
    if (error && !MISSING.test(error.message)) console.error("logAction", error.message);
  } catch (err) {
    console.error("logAction", err);
  }
}

export type AuditFilters = {
  actor?: string;
  action?: string; // prefixo, ex.: "product"
  limit?: number;
  before?: string; // cursor: created_at
};

export async function listAuditLog(f: AuditFilters = {}): Promise<AuditEntry[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  let q = admin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(f.limit ?? 60, 200));
  if (f.actor) q = q.eq("actor_email", f.actor);
  if (f.action) q = q.like("action", `${f.action}%`);
  if (f.before) q = q.lt("created_at", f.before);
  const { data, error } = await q;
  if (error) {
    if (MISSING.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as AuditEntry[];
}

/** E-mails distintos que já apareceram no log (pro filtro). */
export async function listAuditActors(): Promise<string[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("actor_email")
    .order("actor_email")
    .limit(1000);
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.actor_email as string).filter(Boolean))];
}
