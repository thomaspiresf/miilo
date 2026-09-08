"use client";

import { useEffect } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { site } from "@/lib/site";
import { useHydrated } from "@/lib/use-hydrated";

type SubmitArgs = { selectedPaymentMethod: string; formData: Record<string, unknown> };

let initialized = false;

/**
 * Payment Brick do Mercado Pago (checkout transparente).
 * Renderiza Pix, cartão de crédito e cartão de débito no próprio site.
 */
export function PaymentBrick({
  amount,
  email,
  onSubmit,
  onError,
}: {
  amount: number;
  email: string;
  onSubmit: (args: SubmitArgs) => Promise<void>;
  onError?: (err: unknown) => void;
}) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!initialized && site.mpPublicKey) {
      initMercadoPago(site.mpPublicKey, { locale: "pt-BR" });
      initialized = true;
    }
  }, []);

  if (!hydrated) return null;

  return (
    <Payment
      initialization={{ amount, payer: { email } }}
      customization={{
        paymentMethods: {
          bankTransfer: "all", // Pix
          creditCard: "all",
          debitCard: "all",
          ticket: [], // sem boleto
          mercadoPago: [], // sem saldo em conta
        },
        visual: { style: { theme: "default" } },
      }}
      onSubmit={async ({ selectedPaymentMethod, formData }) => {
        await onSubmit({
          selectedPaymentMethod,
          formData: formData as unknown as Record<string, unknown>,
        });
      }}
      onError={(err) => onError?.(err)}
    />
  );
}
