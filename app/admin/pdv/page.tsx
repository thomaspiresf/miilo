import { adminListProducts } from "@/lib/data/admin";
import { listAllOrders } from "@/lib/data/orders";
import { PosClient, type PosProduct } from "@/components/admin/pos-client";

export const metadata = { title: "Venda na loja" };

export default async function AdminPosPage() {
  const [products, orders] = await Promise.all([
    adminListProducts(),
    listAllOrders(),
  ]);

  const catalog: PosProduct[] = products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.images[0]?.url ?? null,
      variants: p.variants
        .filter((v) => v.active)
        .map((v) => ({
          id: v.id,
          label: [v.size, v.color].filter(Boolean).join(" · ") || "Único",
          price: v.price,
          stock: v.stock,
        })),
    }))
    .filter((p) => p.variants.length > 0);

  const recent = orders
    .filter((o) => o.channel === "pos")
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      number: o.number,
      total: o.total,
      status: o.status,
      customer: o.customer_name,
      createdAt: o.created_at,
    }));

  return <PosClient catalog={catalog} recent={recent} />;
}
