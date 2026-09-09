import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, isDemoMode } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/data/orders";
import { getReviewableProducts } from "@/lib/data/reviews";
import { OrderCard } from "@/components/order/order-card";
import { OrderReview } from "@/components/order/order-review";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Meus pedidos" };

const PAID = ["paid", "shipped", "delivered"];

export default async function OrdersPage() {
  const demo = await isDemoMode();
  const user = await getUser();
  if (!demo && !user) redirect("/conta/login?next=/conta/pedidos");

  const orders = await listOrdersForUser(user?.id ?? "demo");

  const reviewables = user
    ? await Promise.all(
        orders.map((o) =>
          PAID.includes(o.status)
            ? getReviewableProducts(o.id, user.id)
            : Promise.resolve(null),
        ),
      )
    : [];

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
          {orders.map((o, i) => {
            const products = reviewables[i];
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <OrderCard order={o} href={`/pedido/${o.id}`} bare />
                {products && products.length > 0 && (
                  <OrderReview orderId={o.id} products={products} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
