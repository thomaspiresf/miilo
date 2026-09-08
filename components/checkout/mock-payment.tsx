"use client";

import { useState } from "react";
import { QrCode, CreditCard } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

type Method = "pix" | "credit_card" | "debit_card";

export function MockPayment({
  amount,
  onSubmit,
  submitting,
}: {
  amount: number;
  onSubmit: (formData: {
    payment_method_id: Method;
    transaction_amount: number;
  }) => void;
  submitting: boolean;
}) {
  const [method, setMethod] = useState<Method>("pix");

  const options: { id: Method; label: string; icon: React.ReactNode; note: string }[] = [
    { id: "pix", label: "Pix", icon: <QrCode className="h-5 w-5" />, note: "Aprovação na hora" },
    { id: "credit_card", label: "Cartão de crédito", icon: <CreditCard className="h-5 w-5" />, note: "Simulado — aprovado" },
    { id: "debit_card", label: "Cartão de débito", icon: <CreditCard className="h-5 w-5" />, note: "Simulado — aprovado" },
  ];

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
        Modo demonstração: nenhum pagamento real é feito. Configure as credenciais
        do Mercado Pago para o checkout transparente (Bricks).
      </p>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
              method === o.id ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="mock-method"
              checked={method === o.id}
              onChange={() => setMethod(o.id)}
              className="accent-primary"
            />
            {o.icon}
            <span className="flex-1">
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted">{o.note}</span>
            </span>
          </label>
        ))}
      </div>
      <Button
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={() =>
          onSubmit({ payment_method_id: method, transaction_amount: amount })
        }
      >
        {submitting ? <Spinner /> : `Pagar ${formatBRL(amount)}`}
      </Button>
    </div>
  );
}
