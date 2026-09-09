import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  hasSupabase,
  adminBypassActive,
  isAdminEmail,
  isMasterAdminEmail,
} from "@/lib/env";
import type { User } from "@supabase/supabase-js";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "customer" | "admin";
  /** admin master — gerencia usuários e apaga pedidos */
  master: boolean;
};

const DEV_ADMIN: SessionUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "admin@local",
  name: "Admin (dev)",
  role: "admin",
  master: true,
};

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    // quem é admin é definido pela lista ADMIN_EMAILS, não pelo banco
    role: isAdminEmail(user.email) ? "admin" : "customer",
    master: isMasterAdminEmail(user.email),
  };
}

/** Usuário logado, ou null. Em modo demonstração retorna null. */
export async function getUser(): Promise<SessionUser | null> {
  if (!hasSupabase()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return toSessionUser(user);
}

export async function requireUser(nextPath = "/conta"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/conta/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * Acesso ao painel /admin.
 * - `ADMIN_DEV_BYPASS=true` (só fora de produção): libera sem login.
 * - Caso contrário: exige login com um e-mail da lista `ADMIN_EMAILS`.
 */
export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser | null> {
  if (adminBypassActive()) return DEV_ADMIN;
  if (!hasSupabase()) return null; // modo demonstração (sem Supabase)
  const user = await getUser();
  if (!user) redirect(`/conta/login?next=${encodeURIComponent(nextPath)}`);
  // conta sem acesso ao painel → manda pro login comum, sem revelar o motivo
  // (não dá pistas de que existe um "modo admin" pra ficar testando contas)
  if (user.role !== "admin") redirect("/conta/login");
  return user;
}

/**
 * Acesso "master": gerenciar usuários, apagar pedidos. Lista `ADMIN_MASTER_EMAILS`.
 * Um admin comum que tente acessar cai de volta no painel.
 */
export async function requireMasterAdmin(): Promise<SessionUser | null> {
  const user = await requireAdmin();
  if (user && !user.master) redirect("/admin");
  return user;
}

/** Loja em modo demonstração (sem Supabase). */
export async function isDemoMode() {
  return !hasSupabase();
}

export function isAdminBypass() {
  return adminBypassActive();
}
