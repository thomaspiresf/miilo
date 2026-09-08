"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

export function OrderStatusPoller({
  orderId,
  initialStatus,
  demo,
}: {
  orderId: string;
  initialStatus: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (status !== "pending") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();
        if (data.status && data.status !== "pending") {
          setStatus(data.status);
          router.refresh();
          clearInterval(id);
        }
      } catch {
        /* segue tentando */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [status, orderId, router]);

  if (status !== "pending") return null;

  return (
    <div className="rounded-xl bg-warning/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-warning">
        <Spinner /> Aguardando confirmação do pagamento…
      </p>
      <p className="mt-1 text-muted">
        Assim que o Pix for compensado, o pedido é atualizado automaticamente.
      </p>
      {demo && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={confirming}
          onClick={async () => {
            setConfirming(true);
            await fetch("/api/dev/confirm-pix", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            setConfirming(false);
            router.refresh();
          }}
        >
          {confirming ? <Spinner /> : "Simular pagamento (demo)"}
        </Button>
      )}
    </div>
  );
}
