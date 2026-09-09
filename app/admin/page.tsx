import { adminListProducts } from "@/lib/data/admin";
import { listAllOrders } from "@/lib/data/orders";
import { SalesDashboard, type DashOrder } from "@/components/admin/sales-dashboard";

export default async function AdminDashboard() {
  const [products, orders] = await Promise.all([
    adminListProducts(),
    listAllOrders(),
  ]);

  const outOfStock = products.reduce(
    (n, p) => n + p.variants.filter((v) => v.active && v.stock === 0).length,
    0,
  );

  const dashOrders: DashOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    email: o.email,
    created_at: o.created_at,
    status: o.status,
    total: o.total,
    channel: o.channel,
    paymentMethod: o.payment_method,
    items: o.items.map((it) => ({
      name: it.product_name,
      qty: it.qty,
      total: it.unit_price * it.qty,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Painel</h1>
      <SalesDashboard orders={dashOrders} outOfStock={outOfStock} />
    </div>
  );
}
