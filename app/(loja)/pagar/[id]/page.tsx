import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getOrderById } from "@/lib/data/orders";
import { paymentsMocked } from "@/lib/env";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PayOrderClient } from "@/components/checkout/pay-order-client";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

export default async function PayOrderPage(props: PageProps<"/pagar/[id]">) {
  const { id } = await props.params;
  const order = await getOrderById(id);
  if (!order) notFound();

  if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-2 text-xl font-black">Pagamento confirmado</h1>
        <p className="mt-1 text-sm text-muted">
          Pedido {order.number} · {formatBRL(order.total)}
        </p>
        <Button asChild className="mt-4">
          <Link href={`/pedido/${order.id}`}>Ver pedido</Link>
        </Button>
      </div>
    );
  }

  if (order.status === "cancelled" || order.status === "failed") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center">
        <XCircle className="mx-auto h-12 w-12 text-danger" />
        <h1 className="mt-2 text-xl font-black">Este link não está mais ativo</h1>
        <p className="mt-1 text-sm text-muted">
          Fale com a loja para gerar um novo link de pagamento.
        </p>
      </div>
    );
  }

  return (
    <PayOrderClient
      orderId={order.id}
      orderNumber={order.number}
      amount={order.total}
      email={order.email}
      paymentsMocked={paymentsMocked()}
      items={order.items.map((it) => ({
        id: it.id,
        name: it.product_name,
        label: it.variant_label,
        qty: it.qty,
        total: it.unit_price * it.qty,
      }))}
    />
  );
}
