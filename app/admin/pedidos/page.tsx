import Link from "next/link";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL } from "@/lib/format";
import { OrderList, type OrderListItem } from "@/components/admin/order-list";
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

const toItem = (o: Order): OrderListItem => ({
  id: o.id,
  number: o.number,
  email: o.email,
  customerName: o.customer_name,
  created_at: o.created_at,
  status: o.status,
  total: o.total,
  channel: o.channel,
  paymentMethod: o.payment_method,
  posPayMode: o.pos_pay_mode,
  items: o.items.map((it) => ({
    name: it.product_name,
    qty: it.qty,
    total: it.unit_price * it.qty,
  })),
});

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

      <OrderList orders={orders.map(toItem)} empty="Nenhum pedido." />
    </div>
  );
}
