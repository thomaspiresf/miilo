import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, PartyPopper } from "lucide-react";
import { getOrderById } from "@/lib/data/orders";
import { reconcileOrderPayment, pixQrForPayment } from "@/lib/mp-reconcile";
import { isDemoMode } from "@/lib/auth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { site } from "@/lib/site";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { OrderStatusPoller } from "@/components/order/order-status-poller";
import { PixQr } from "@/components/checkout/pix-qr";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default async function OrderPage(props: PageProps<"/pedido/[id]">) {
  const { id } = await props.params;
  let order = await getOrderById(id);
  if (!order) notFound();

  // re-checa o pagamento no MP (rede de segurança do webhook)
  if (order.status === "pending" && order.mp_payment_id) {
    await reconcileOrderPayment(id, order.mp_payment_id);
    order = (await getOrderById(id)) ?? order;
  }

  // Pix ainda não pago → mostra o QR / copia-e-cola de novo
  const pixQr =
    order.status === "pending" && order.mp_payment_id
      ? await pixQrForPayment(order.mp_payment_id)
      : null;

  const demo = await isDemoMode();
  const status = ORDER_STATUS[order.status];

  const confirmed = ["paid", "shipped", "delivered"].includes(order.status);
  const pickup = order.delivery_mode === "pickup";
  const realEmail = order.email && !order.email.endsWith("@miilo.com.br");
  const expired =
    (order.status === "cancelled" || order.status === "failed") &&
    order.mp_status === "expired";

  const headline = confirmed
    ? "Obrigado pela compra! 🎉"
    : expired
      ? "O prazo de pagamento venceu"
      : order.status === "failed" || order.status === "cancelled"
        ? `Pedido ${status.label.toLowerCase()}`
        : "Pedido recebido";

  const subline = confirmed
    ? pickup
      ? "Pagamento confirmado. Vamos separar tudo e te avisar quando estiver pronto pra retirar."
      : "Pagamento confirmado. Já estamos preparando seu pedido — quando enviarmos, você recebe o código de rastreio."
    : expired
      ? "O pedido não foi pago no prazo e os itens voltaram pro estoque. Você pode fazer um novo pedido quando quiser."
      : order.status === "pending"
        ? "Assim que o pagamento cair, o pedido é confirmado automaticamente."
        : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        {confirmed ? (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <PartyPopper className="h-7 w-7 text-success" />
          </div>
        ) : order.status === "pending" ? (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-7 w-7 text-warning" />
          </div>
        ) : null}

        <h1 className="mt-3 text-xl font-black">{headline}</h1>
        {subline && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{subline}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold">Pedido {order.number}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">{formatDateTime(order.created_at)}</span>
        </div>
        <div className="mt-2">
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        {confirmed && realEmail && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Enviamos a confirmação para {order.email}
          </p>
        )}
      </div>

      {pixQr && (
        <PixQr
          qrCode={pixQr.qr_code}
          qrCodeBase64={pixQr.qr_code_base64}
          amount={order.total}
        />
      )}

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
          {order.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Desconto{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span>−{formatBRL(order.discount)}</span>
            </div>
          )}
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
