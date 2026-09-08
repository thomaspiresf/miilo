import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, isDemoMode } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/data/orders";
import { OrderCard } from "@/components/order/order-card";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  const demo = await isDemoMode();
  const user = await getUser();
  if (!demo && !user) redirect("/conta/login?next=/conta/pedidos");

  const orders = await listOrdersForUser(user?.id ?? "demo");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-black">Meus pedidos</h1>
      {orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido ainda"
          description="Quando você comprar, o histórico aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} href={`/pedido/${o.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
