"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { formatBRL, parseMoney } from "@/lib/format";
import { setCashPaidAction } from "@/app/admin/pedidos/actions";
import { markPosSalePaid } from "@/app/admin/pdv/actions";

/**
 * Edita o pagamento de uma venda que ainda não foi paga: quanto o cliente já
 * entregou em dinheiro/maquininha. O mesmo link /pagar/[id] passa a cobrar só o
 * que falta (Pix ou cartão).
 */
export function SplitPaymentEditor({
  orderId,
  total,
  cashPaid,
  payUrl,
}: {
  orderId: string;
  total: number;
  cashPaid: number;
  payUrl: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(cashPaid > 0 ? String(cashPaid).replace(".", ",") : "");
  const [pending, startTransition] = useTransition();
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const typed = value.trim() === "" ? 0 : (parseMoney(value) ?? 0);
  const preview = Math.max(0, Math.round((total - Math.min(typed, total)) * 100) / 100);
  const dirty = Math.abs(typed - cashPaid) > 0.004;
  const covers = typed >= total && total > 0;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await setCashPaidAction(orderId, value);
      if (res.ok) {
        setMessage({ ok: true, text: `Salvo. O link agora cobra ${formatBRL(res.due)}.` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  async function markPaid() {
    setPaying(true);
    setMessage(null);
    const res = await markPosSalePaid(orderId);
    setPaying(false);
    if ("error" in res) setMessage({ ok: false, text: res.error });
    else {
      setMessage({ ok: true, text: "Marcado como pago." });
      router.refresh();
    }
  }

  function copy() {
    navigator.clipboard?.writeText(payUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-3 text-sm">
      <div>
        <p className="font-bold">Pagar em mais de uma forma</p>
        <p className="text-xs text-muted">
          Informe quanto o cliente já entregou em dinheiro/maquininha. O link abaixo (o mesmo de antes) passa a
          cobrar só o restante.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-muted">
          Total recebido em dinheiro (R$)
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage(null);
            }}
            placeholder="0,00"
            className="mt-1 block h-10 w-36 rounded-lg border border-border bg-background px-3 text-right text-base font-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <Button size="sm" onClick={save} disabled={pending || !dirty || covers}>
          {pending ? <Spinner /> : null}
          Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={markPaid} disabled={paying}>
          {paying ? <Spinner /> : <Banknote className="h-4 w-4" />}
          Recebi tudo — marcar como pago
        </Button>
      </div>

      <p className="text-xs">
        Total {formatBRL(total)}
        {typed > 0 && !covers ? (
          <>
            {" "}
            − dinheiro {formatBRL(typed)} = <strong className="text-primary">link cobra {formatBRL(preview)}</strong>
          </>
        ) : null}
        {covers ? <span className="text-warning"> · esse valor cobre tudo: use “Recebi tudo”.</span> : null}
      </p>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={payUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-muted"
        />
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>

      {message && (
        <p className={message.ok ? "text-xs font-semibold text-success" : "text-xs text-danger"}>{message.text}</p>
      )}
    </div>
  );
}
