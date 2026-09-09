import Link from "next/link";
import { requireAdmin, isDemoMode, isAdminBypass } from "@/lib/auth";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const master = user?.master ?? false;
  const demo = await isDemoMode();
  const bypass = isAdminBypass();
  // Supabase ligado para leitura mas sem a chave secret => escrita não persiste
  const noWrite = hasSupabase() && !hasSupabaseAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo variant="horizontal" className="h-6 w-auto" />
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-semibold">
              admin
            </span>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary">
            ver loja
          </Link>
        </div>
      </header>

      {demo && (
        <div className="bg-warning/15 px-4 py-1.5 text-center text-xs font-medium text-warning">
          Modo demonstração — alterações ficam só em memória e somem ao reiniciar
          o servidor. Configure o Supabase para persistir.
        </div>
      )}
      {!demo && bypass && (
        <div className="bg-accent/15 px-4 py-1.5 text-center text-xs font-medium text-accent">
          Acesso liberado sem login (ADMIN_DEV_BYPASS). Desligue antes de publicar.
        </div>
      )}
      {noWrite && (
        <div className="bg-danger/10 px-4 py-1.5 text-center text-xs font-medium text-danger">
          Falta a chave <code>SUPABASE_SERVICE_ROLE_KEY</code> (sb_secret_…) no
          <code> .env.local</code> — sem ela o admin não grava produtos no banco.
        </div>
      )}

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-48 shrink-0 md:block">
          <AdminNav master={master} />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <AdminNav master={master} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
