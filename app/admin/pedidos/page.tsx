import Link from "next/link";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { Badge } from "@/components/ui/misc";
import type { Order, OrderStatus } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "receber", label: "A receber (loja)" },
  { value: "pending", label: "Aguardando" },
  { value: "paid", label: "Pagos" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "failed", label: "Falhos" },
];

const isReceivable = (o: Order) => o.channel === "pos" && o.status === "pending";

export default async function AdminOrdersPage(props: PageProps<"/admin/pedidos">) {
  const sp = await props.searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "";
  const receberView = raw === "receber";
  const status = (receberView ? "" : raw) as OrderStatus | "";

  const all = await listAllOrders();
  const receivables = all.filter(isReceivable);
  const receivableTotal = receivables.reduce((s, o) => s + o.total, 0);

  const orders = receberView
    ? receivables
    : status
      ? all.filter((o) => o.status === status)
      : all;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Pedidos</h1>

      {receivables.length > 0 && !receberView && (
        <Link
          href="/admin/pedidos?status=receber"
          className="block rounded-xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning hover:bg-warning/15"
        >
          A receber: {formatBRL(receivableTotal)} em{" "}
          {receivables.length === 1 ? "1 venda" : `${receivables.length} vendas`} da
          loja — ver →
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/pedidos?status=${f.value}` : "/admin/pedidos"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              raw === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {receberView && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Total a receber</span>
          <span className="font-black">{formatBRL(receivableTotal)}</span>
        </div>
      )}

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
            {isReceivable(o) ? (
              <Badge tone="warning">a receber</Badge>
            ) : o.channel === "pos" ? (
              <Badge tone="primary">loja</Badge>
            ) : (
              o.delivery_mode === "pickup" && <Badge tone="warning">retirada</Badge>
            )}
            {!isReceivable(o) && (
              <Badge tone={ORDER_STATUS[o.status].tone}>
                {ORDER_STATUS[o.status].label}
              </Badge>
            )}
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
