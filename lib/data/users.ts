import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin, isAdminEmail, isMasterAdminEmail } from "@/lib/env";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  isAdmin: boolean;
  isMaster: boolean;
};

/** Lista as contas (Supabase Auth). Ordena admins primeiro, depois por data. */
export async function listUsers(): Promise<AdminUserRow[]> {
  if (!hasSupabaseAdmin()) return [];
  const admin = createAdminClient();
  const out: AdminUserRow[] = [];
  // pagina até acabar (loja pequena — poucas páginas)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      out.push({
        id: u.id,
        email: u.email ?? "—",
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        isAdmin: isAdminEmail(u.email),
        isMaster: isMasterAdminEmail(u.email),
      });
    }
    if (users.length < 200) break;
  }
  return out.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  name: string | null;
}): Promise<void> {
  if (!hasSupabaseAdmin()) {
    throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY para criar contas.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.name ? { full_name: input.name } : undefined,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
      throw new Error("Já existe uma conta com esse e-mail.");
    }
    throw new Error(error.message);
  }
}

export async function adminDeleteUser(id: string): Promise<void> {
  if (!hasSupabaseAdmin()) {
    throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY.");
  }
  const admin = createAdminClient();
  // trava: não deixa apagar um admin master pela interface
  const { data } = await admin.auth.admin.getUserById(id);
  if (data?.user && isMasterAdminEmail(data.user.email)) {
    throw new Error("Não é possível apagar um admin master por aqui.");
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
}

