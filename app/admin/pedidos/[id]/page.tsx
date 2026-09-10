import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/data/orders";
import { reconcileOrderPayment } from "@/lib/mp-reconcile";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { updateOrderStatusAction, recheckPaymentAction } from "@/app/admin/actions";
import { site } from "@/lib/site";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import type { OrderStatus } from "@/lib/types";

const ALL_STATUS: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "failed",
];

export default async function AdminOrderPage(props: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await props.params;
  const user = await requireAdmin();
  let order = await getOrderById(id);
  if (!order) notFound();

  // pedido pendente com pagamento no MP → re-checa (caso o webhook não tenha caído)
  if (order.status === "pending" && order.mp_payment_id) {
    await reconcileOrderPayment(id, order.mp_payment_id);
    order = (await getOrderById(id)) ?? order;
  }

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
        {order.channel === "pos" && (
          <p className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            Venda presencial (PDV)
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-bold">Pagamento</h2>
        <p className="text-muted">
          Método: {order.payment_method ?? "—"} · MP: {order.mp_payment_id ?? "—"} (
          {order.mp_status ?? "—"})
        </p>
        {order.status === "pending" && order.mp_payment_id && (
          <form action={recheckPaymentAction} className="mt-3">
            <input type="hidden" name="id" value={order.id} />
            <Button type="submit" size="sm" variant="outline">
              Rechecar pagamento no Mercado Pago
            </Button>
          </form>
        )}
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
            <span className="text-muted">Subtotal</span>
            <span>{formatBRL(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Desconto{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>−{formatBRL(order.discount)}</span>
            </div>
          )}
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
          <p className="mt-1 text-muted">
            Cliente retira na loja — {site.storeAddress}
          </p>
        ) : null}
        {order.notes && (
          <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-warning">
            <span className="font-bold">Observação:</span> {order.notes}
          </p>
        )}
      </section>

      <form
        action={updateOrderStatusAction}
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="font-bold">Atualizar pedido</h2>
        <input type="hidden" name="id" value={order.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Status</span>
            <select
              name="status"
              defaultValue={order.status}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3"
            >
              {ALL_STATUS.map((s) => (
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
        <p className="text-xs text-muted">
          Marcar como “Pagamento aprovado” baixa o estoque e envia a confirmação
          por e-mail (igual quando o pagamento cai sozinho).
        </p>
        <Button type="submit">Salvar</Button>
      </form>

      {user && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.03] p-5">
          <h2 className="font-bold text-danger">Apagar pedido</h2>
          <p className="mt-1 text-xs text-muted">
            Some de vez do sistema. Se o estoque já tinha sido baixado, ele volta.
            Use só pra pedidos de teste, duplicados ou lançados errado.
          </p>
          <DeleteOrderButton orderId={order.id} number={order.number} />
        </div>
      )}
    </div>
  );
}
