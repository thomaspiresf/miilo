"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/misc";
import { chargeOrderAction } from "@/app/admin/pedidos/actions";

/**
 * Botão "Enviar cobrança" de um pedido atrasado: abre um pop-up com a mensagem
 * (editável) e envia pelo mesmo caminho do painel de Cobranças em Conversas.
 */
export function ChargeDialog({
  orderId,
  orderNumber,
  customerName,
  hasPhone,
  defaultMessage,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  hasPhone: boolean;
  defaultMessage: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    const res = await chargeOrderAction(orderId, text ?? defaultMessage);
    setSending(false);
    setResult(res);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!hasPhone} title={hasPhone ? undefined : "Sem telefone cadastrado"}>
        <Send className="h-4 w-4" /> Enviar cobrança
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setResult(null);
        }}
      >
        <ModalContent
          title={`Cobrar ${orderNumber}`}
          description={`${customerName || "Cliente da loja"} · vai pelo WhatsApp da loja`}
        >
          <textarea
            value={text ?? defaultMessage}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={send} disabled={sending || result?.ok}>
              {sending ? <Spinner /> : <Send className="h-4 w-4" />}
              {result?.ok ? "Enviado!" : "Enviar no WhatsApp"}
            </Button>
            {result?.error && <span className="text-xs text-danger">{result.error}</span>}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Se o cliente falou com a loja nas últimas 24h, vai o texto acima; fora disso, vai o modelo aprovado de cobrança.
          </p>
        </ModalContent>
      </Modal>
    </>
  );
}
