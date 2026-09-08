import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getOrderById } from "@/lib/data/orders";
import { isDemoMode } from "@/lib/auth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { site } from "@/lib/site";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { OrderStatusPoller } from "@/components/order/order-status-poller";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default async function OrderPage(props: PageProps<"/pedido/[id]">) {
  const { id } = await props.params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const demo = await isDemoMode();
  const status = ORDER_STATUS[order.status];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        {order.status === "paid" || order.status === "delivered" ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        ) : null}
        <h1 className="mt-2 text-xl font-black">Pedido {order.number}</h1>
        <p className="mt-1 text-sm text-muted">
          Feito em {formatDateTime(order.created_at)}
        </p>
        <div className="mt-3">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      {order.status === "pending" && (
        <OrderStatusPoller orderId={order.id} initialStatus={order.status} demo={demo} />
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-black">Itens</h2>
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
                {it.image_url && (
                  <Image src={it.image_url} alt={it.product_name} fill className="object-cover" sizes="56px" />
                )}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{it.product_name}</p>
                <p className="text-xs text-muted">
                  {it.variant_label} · {it.qty}x
                </p>
              </div>
              <span className="text-sm font-semibold">
                {formatBRL(it.unit_price * it.qty)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatBRL(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">
              Frete {order.shipping_service ? `(${order.shipping_service})` : ""}
            </span>
            <span>{order.shipping_cost === 0 ? "Grátis" : formatBRL(order.shipping_cost)}</span>
          </div>
          <div className="flex justify-between pt-2 text-base font-black">
            <span>Total</span>
            <span>{formatBRL(order.total)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-black">
          {order.delivery_mode === "pickup" ? "Retirada na loja" : "Entrega"}
        </h2>
        {order.customer_name && <p className="font-semibold">{order.customer_name}</p>}
        {order.phone && <p className="text-muted">{order.phone}</p>}
        {order.delivery_mode === "pickup" ? (
          <>
            <p className="mt-1 font-semibold">{site.storeAddress}</p>
            <p className="text-muted">{site.pickupNote}</p>
          </>
        ) : order.address ? (
          <>
            <p className="mt-1 text-muted">
              {order.address.street}, {order.address.number}
              {order.address.complement ? ` — ${order.address.complement}` : ""}
            </p>
            <p className="text-muted">
              {order.address.district} · {order.address.city}/{order.address.state} ·{" "}
              {order.address.cep}
            </p>
          </>
        ) : null}
        {order.tracking_code && (
          <p className="mt-2">
            Rastreio: <span className="font-semibold">{order.tracking_code}</span>
          </p>
        )}
      </section>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/conta/pedidos">Meus pedidos</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/">Continuar comprando</Link>
        </Button>
      </div>
    </div>
  );
}
