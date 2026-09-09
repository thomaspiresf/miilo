import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getUser, isDemoMode } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/data/orders";
import { OrderCard } from "@/components/order/order-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const demo = await isDemoMode();
  const user = await getUser();

  if (!demo && !user) redirect("/conta/login");

  const orders = user ? await listOrdersForUser(user.id) : demo ? await listOrdersForUser("demo") : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Minha conta</h1>
          <p className="text-sm text-muted">
            {user ? (user.name ?? user.email) : "Modo demonstração"}
          </p>
        </div>
        {user && <SignOutButton />}
      </div>

      {demo && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          Sem Supabase configurado, não há contas de cliente. Esta página mostra
          os pedidos criados nesta sessão de demonstração.
        </p>
      )}

      {user?.role === "admin" && (
        <Link
          href="/admin"
          className="flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3.5 font-bold text-accent hover:bg-accent/10"
        >
          Painel administrativo
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      <nav className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {[
          { href: "/conta/pedidos", label: "Meus pedidos" },
          { href: "/conta/enderecos", label: "Endereços" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between px-4 py-3.5 font-semibold hover:bg-black/[0.02]"
          >
            {l.label}
            <ChevronRight className="h-4 w-4 text-muted" />
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-3 font-black">Pedidos recentes</h2>
        {orders.length === 0 ? (
          <EmptyState title="Você ainda não fez pedidos" />
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 3).map((o) => (
              <OrderCard key={o.id} order={o} href={`/pedido/${o.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
