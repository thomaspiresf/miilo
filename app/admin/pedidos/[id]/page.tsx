import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders";
import { formatBRL, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { updateOrderStatusAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

const NEXT_STATUS = ["paid", "shipped", "delivered", "cancelled"] as const;

export default async function AdminOrderPage(props: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await props.params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/pedidos" className="text-sm text-primary">
          ← Pedidos
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-black">{order.number}</h1>
          <Badge tone={ORDER_STATUS[order.status].tone}>
            {ORDER_STATUS[order.status].label}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          {formatDateTime(order.created_at)} · {order.email}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-bold">Pagamento</h2>
        <p className="text-muted">
          Método: {order.payment_method ?? "—"} · MP: {order.mp_payment_id ?? "—"} (
          {order.mp_status ?? "—"})
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-bold">Itens</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>
                {it.qty}× {it.product_name}
                {it.variant_label ? ` (${it.variant_label})` : ""}
              </span>
              <span className="font-semibold">{formatBRL(it.unit_price * it.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Frete ({order.shipping_service ?? "—"})</span>
            <span>{formatBRL(order.shipping_cost)}</span>
          </div>
          <div className="flex justify-between font-black">
            <span>Total</span>
            <span>{formatBRL(order.total)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-bold">
          {order.delivery_mode === "pickup" ? "Retirada na loja" : "Entrega"}
        </h2>
        <p className="font-semibold">{order.customer_name ?? "—"}</p>
        {order.phone && (
          <p className="text-muted">
            Tel/WhatsApp: <span className="font-semibold text-foreground">{order.phone}</span>
          </p>
        )}
        {order.delivery_mode === "delivery" && order.address ? (
          <>
            <p className="mt-1 text-muted">
              {order.address.street}, {order.address.number}
              {order.address.complement ? ` — ${order.address.complement}` : ""} ·{" "}
              {order.address.district}
            </p>
            <p className="text-muted">
              {order.address.city}/{order.address.state} · {order.address.cep}
            </p>
          </>
        ) : order.delivery_mode === "pickup" ? (
          <p className="mt-1 text-muted">Cliente retira na loja (sem frete).</p>
        ) : null}
      </section>

      <form
        action={updateOrderStatusAction}
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="font-bold">Atualizar pedido</h2>
        <input type="hidden" name="id" value={order.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Status</span>
            <select
              name="status"
              defaultValue={order.status}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3"
            >
              {NEXT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Código de rastreio</span>
            <input
              name="trackingCode"
              defaultValue={order.tracking_code ?? ""}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3"
            />
          </label>
        </div>
        <Button type="submit">Salvar</Button>
      </form>
    </div>
  );
}
