import Link from "next/link";
import { adminListProducts } from "@/lib/data/admin";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { Badge } from "@/components/ui/misc";

export default async function AdminDashboard() {
  const [products, orders] = await Promise.all([
    adminListProducts(),
    listAllOrders(),
  ]);

  const paid = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter(
    (p) => p.active && p.variants.some((v) => v.stock > 0 && v.stock <= 3),
  ).length;

  const cards = [
    { label: "Receita paga", value: formatBRL(revenue) },
    { label: "Pedidos", value: String(orders.length) },
    { label: "Aguardando pgto.", value: String(pending) },
    { label: "Produtos ativos", value: String(products.filter((p) => p.active).length) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-black">Painel</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {c.label}
            </p>
            <p className="mt-1 text-xl font-black">{c.value}</p>
          </div>
        ))}
      </div>

      {lowStock > 0 && (
        <Link
          href="/admin/estoque?f=low"
          className="block rounded-xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning hover:bg-warning/15"
        >
          {lowStock} produto(s) com estoque baixo (≤ 3 unidades em alguma
          variação) — ajustar →
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-primary">
            ver todos
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {orders.slice(0, 6).map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos/${o.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-black/[0.02]"
              >
                <span className="font-semibold">{o.number}</span>
                <span className="text-muted">{o.email}</span>
                <Badge tone={ORDER_STATUS[o.status].tone}>
                  {ORDER_STATUS[o.status].label}
                </Badge>
                <span className="font-bold">{formatBRL(o.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
