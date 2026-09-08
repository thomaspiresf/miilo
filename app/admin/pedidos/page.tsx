import Link from "next/link";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { Badge } from "@/components/ui/misc";
import type { OrderStatus } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Aguardando" },
  { value: "paid", label: "Pagos" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "failed", label: "Falhos" },
];

export default async function AdminOrdersPage(props: PageProps<"/admin/pedidos">) {
  const sp = await props.searchParams;
  const status = (typeof sp.status === "string" ? sp.status : "") as OrderStatus | "";
  const orders = await listAllOrders(status || undefined);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Pedidos</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/pedidos?status=${f.value}` : "/admin/pedidos"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/admin/pedidos/${o.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-black/[0.02]"
          >
            <span className="font-bold">{o.number}</span>
            <span className="text-muted">{formatDate(o.created_at)}</span>
            <span className="text-muted">{o.customer_name ?? o.email}</span>
            {o.channel === "pos" ? (
              <Badge tone="primary">loja</Badge>
            ) : (
              o.delivery_mode === "pickup" && <Badge tone="warning">retirada</Badge>
            )}
            <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
            <span className="ml-auto font-bold">{formatBRL(o.total)}</span>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Nenhum pedido.</p>
        )}
      </div>
    </div>
  );
}
