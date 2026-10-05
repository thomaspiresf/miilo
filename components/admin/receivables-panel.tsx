"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { formatBRL, formatDateTime, formatWhatsAppPhone } from "@/lib/format";
import { chargeOrderAction } from "@/app/admin/pedidos/actions";
import { SplitPaymentEditor } from "@/components/admin/split-payment-editor";

export type ReceivableItem = {
  id: string;
  number: string;
  customerName: string | null;
  /** dígitos sem o 55 (como fica salvo no pedido) — null se a venda não tem telefone. */
  phone: string | null;
  /** o que falta receber (total − parte já paga em dinheiro) */
  total: number;
  /** valor cheio da venda */
  fullTotal: number;
  /** parte já recebida em dinheiro/maquininha */
  cashPaid: number;
  payUrl: string;
  created_at: string;
  /** há mais de 7 dias sem pagar */
  overdue: boolean;
  defaultMessage: string;
};

/**
 * Painel de cobrança das vendas "a receber"/"com link" — o número da loja é
 * um número de API (Meta Cloud API), então não dá mais pra digitar e mandar
 * pelo WhatsApp do celular; o envio sai daqui (chargeOrderAction), pelo
 * mesmo caminho do /admin/conversas. Só funciona se o cliente tiver mandado
 * mensagem pro número nas últimas 24h.
 */
export function ReceivablesPanel({ items }: { items: ReceivableItem[] }) {
  const router = useRouter();
  // só guarda o que a pessoa digitou; sem edição manual, vale a mensagem padrão (que muda com o valor a cobrar)
  const [edited, setEdited] = useState<Record<string, string>>({});
  const textOf = (it: ReceivableItem) => edited[it.id] ?? it.defaultMessage;
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; error?: string } | undefined>>({});

  async function send(id: string) {
    setSendingId(id);
    setResults((r) => ({ ...r, [id]: undefined }));
    const res = await chargeOrderAction(id, textOf(items.find((x) => x.id === id)!));
    setResults((r) => ({ ...r, [id]: res }));
    setSendingId(null);
    if (res.ok) router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Nenhuma venda a receber.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const result = results[it.id];
        return (
          <div key={it.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {it.number} · {it.customerName || "Cliente da loja"}
                  {it.overdue && (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                      atrasado
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {it.phone ? formatWhatsAppPhone(`55${it.phone}`) : "sem telefone cadastrado"} ·{" "}
                  {formatDateTime(it.created_at)}
                </p>
              </div>
              <span className="shrink-0 font-black">{formatBRL(it.total)}</span>
            </div>

            <textarea
              value={textOf(it)}
              onChange={(e) => setEdited((t) => ({ ...t, [it.id]: e.target.value }))}
              rows={9}
              className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => send(it.id)}
                disabled={!it.phone || sendingId === it.id}
              >
                {sendingId === it.id ? <Spinner /> : <Send className="h-4 w-4" />}
                Cobrar no WhatsApp
              </Button>
              {result?.ok && (
                <span className="text-xs font-semibold text-success">Enviado!</span>
              )}
              {result?.error && <span className="text-xs text-danger">{result.error}</span>}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-primary">
                Editar pagamento (dinheiro + Pix/cartão)
                {it.cashPaid > 0 ? ` · ${formatBRL(it.cashPaid)} já em dinheiro` : ""}
              </summary>
              <div className="mt-2">
                <SplitPaymentEditor
                  orderId={it.id}
                  total={it.fullTotal}
                  cashPaid={it.cashPaid}
                  payUrl={it.payUrl}
                />
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
