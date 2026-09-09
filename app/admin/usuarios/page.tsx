import { requireMasterAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";
import { hasSupabaseAdmin } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { UserForm } from "@/components/admin/user-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { deleteUserAction } from "@/app/admin/usuarios/actions";

export const metadata = { title: "Usuários" };

export default async function AdminUsersPage() {
  const me = await requireMasterAdmin();
  const users = hasSupabaseAdmin() ? await listUsers() : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">Usuários</h1>
        <p className="mt-1 text-sm text-muted">
          Contas de clientes e admins. Área exclusiva do admin master.
        </p>
      </div>

      {!hasSupabaseAdmin() && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          Sem <code>SUPABASE_SERVICE_ROLE_KEY</code> não dá pra listar contas.
        </p>
      )}

      {users.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  {u.email}
                  {u.isMaster ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      master
                    </span>
                  ) : u.isAdmin ? (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                      admin
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted">
                  {u.name ? `${u.name} · ` : ""}
                  criado {formatDate(u.createdAt)}
                  {u.lastSignInAt ? ` · último acesso ${formatDate(u.lastSignInAt)}` : " · nunca acessou"}
                </p>
              </div>

              {!u.isMaster && me?.id !== u.id && (
                <form action={deleteUserAction} className="ml-auto">
                  <input type="hidden" name="id" value={u.id} />
                  <ConfirmSubmit
                    message={`Apagar a conta ${u.email}? Isso é permanente. Os pedidos dessa pessoa continuam no sistema.`}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    apagar
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <UserForm />
    </div>
  );
}
