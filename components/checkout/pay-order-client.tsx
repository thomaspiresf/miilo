"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { site } from "@/lib/site";
import { Spinner } from "@/components/ui/misc";
import { MockPayment } from "@/components/checkout/mock-payment";
import { PaymentBrick } from "@/components/checkout/payment-brick";

type Item = { id: string; name: string; label: string | null; qty: number; total: number };

export function PayOrderClient({
  orderId,
  orderNumber,
  amount,
  email,
  items,
  paymentsMocked,
}: {
  orderId: string;
  orderNumber: string;
  amount: number;
  email: string;
  items: Item[];
  paymentsMocked: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function processPayment(formData: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pagamento recusado");

      if (data.status === "rejected") {
        setError("Pagamento recusado. Tente outro método ou cartão.");
        return;
      }
      // aprovado, Pix gerado ou pendente — acompanha na página do pedido
      setDone(true);
      router.push(`/pedido/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Spinner className="mx-auto" />
        <p className="mt-2 text-sm text-muted">Levando você para o pedido…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-black">Pagamento</h1>
        <p className="text-sm text-muted">
          Pedido <span className="font-semibold text-foreground">{orderNumber}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                {it.qty}× {it.name}
                {it.label ? <span className="text-muted"> · {it.label}</span> : null}
              </span>
              <span className="shrink-0 font-semibold">{formatBRL(it.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-black">
          <span>Total</span>
          <span>{formatBRL(amount)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5">
        {!paymentsMocked && site.mpPublicKey ? (
          <PaymentBrick
            amount={amount}
            email={email}
            onSubmit={({ formData }) => processPayment(formData)}
            onError={(err) => {
              console.error(err);
              setError("Erro ao carregar o pagamento.");
            }}
          />
        ) : (
          <MockPayment amount={amount} submitting={submitting} onSubmit={processPayment} />
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <CheckCircle2 className="h-3.5 w-3.5" /> Pagamento processado pelo Mercado Pago
      </p>
    </div>
  );
}
