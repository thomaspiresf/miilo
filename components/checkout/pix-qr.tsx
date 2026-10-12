"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatBRL, formatDateTime } from "@/lib/format";

export function PixQr({
  qrCode,
  qrCodeBase64,
  amount,
  expiresAt,
}: {
  qrCode: string;
  qrCodeBase64?: string | null;
  amount: number;
  /** validade do Pix (ISO), como o Mercado Pago informou */
  expiresAt?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(qrCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-black">Pague com Pix — {formatBRL(amount)}</h2>
      <p className="mt-1 text-sm text-muted">
        Abra o app do seu banco, escolha pagar com Pix e escaneie o QR ou cole o
        código.{expiresAt ? ` Vale até ${formatDateTime(expiresAt)}.` : ""}
      </p>

      {qrCodeBase64 && (
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR code do Pix"
            width={220}
            height={220}
            className="rounded-xl border border-border"
          />
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-muted">Pix copia e cola</p>
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={qrCode}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs text-muted"
          />
          <button
            type="button"
            onClick={copy}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Assim que o Pix cair, o pedido é confirmado automaticamente — pode
        acompanhar por esta página.
      </p>
    </div>
  );
}
