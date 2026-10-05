"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { OrderChannel, OrderStatus } from "@/lib/types";
import { ORDER_STATUS } from "@/lib/order-status";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ChargeDialog } from "@/components/admin/charge-dialog";

export type OrderListItem = {
  id: string;
  number: string;
  email: string;
  customerName?: string | null;
  created_at: string;
  status: OrderStatus;
  total: number;
  channel: OrderChannel;
  paymentMethod: string | null;
  posPayMode?: string | null;
  /** venda a receber há mais de 7 dias */
  overdue?: boolean;
  phone?: string | null;
  /** mensagem de cobrança pronta (só em venda a receber) */
  chargeMessage?: string;
  items: { name: string; qty: number; total: number }[];
};

function payLabel(method: string | null): string {
  if (!method) return "Não informado";
  const m = method.toLowerCase();
  // pagamento dividido: "dinheiro + pix"
  if (m.startsWith("dinheiro + ")) return `Dinheiro + ${payLabel(m.slice(11))}`;
  if (m.includes("pix")) return "Pix";
  if (m.includes("dinheiro") || m === "manual" || m.includes("cash"))
    return "Dinheiro / maquininha";
  if (m.includes("account")) return "Saldo Mercado Pago";
  return "Cartão";
}

const isReceivable = (o: OrderListItem) =>
  o.channel === "pos" && o.status === "pending";

export function OrderList({
  orders,
  empty = "Nenhum pedido.",
}: {
  orders: OrderListItem[];
  empty?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (orders.length === 0)
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        {empty}
      </p>
    );

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {orders.map((o) => {
        const isOpen = open.has(o.id);
        const receivable = isReceivable(o);
        return (
          <div key={o.id}>
            <button
              type="button"
              onClick={() => toggle(o.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-x-2 gap-y-1 px-4 py-3 text-left text-sm hover:bg-black/[0.02] max-sm:flex-wrap sm:gap-3"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted transition-transform",
                  isOpen && "rotate-180",
                )}
              />
              <span className="shrink-0 whitespace-nowrap font-semibold">
                {o.number}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-muted sm:block">
                {o.customerName || o.email}
              </span>
              <span className="font-bold max-sm:ml-auto sm:order-last">
                {formatBRL(o.total)}
              </span>
              {receivable ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={o.overdue ? "danger" : "warning"}>{o.overdue ? "atrasado" : "a receber"}</Badge>
                  <span className="text-xs text-muted">
                    {o.posPayMode === "later" ? "anotado" : "com link"}
                  </span>
                </span>
              ) : (
                <Badge tone={ORDER_STATUS[o.status].tone}>
                  {ORDER_STATUS[o.status].label}
                </Badge>
              )}
            </button>
            {isOpen && (
              <div className="border-t border-border/60 bg-black/[0.015] px-4 py-3 text-sm">
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{formatDateTime(o.created_at)}</span>
                  <span>{payLabel(o.paymentMethod)}</span>
                  <span>
                    {o.channel === "pos" ? "Venda na loja" : "Loja online"}
                  </span>
                  <span className="sm:hidden">{o.customerName || o.email}</span>
                </div>
                <ul className="space-y-1">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {it.qty}× {it.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {formatBRL(it.total)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" className="w-full sm:w-auto">
                    <Link prefetch={false} href={`/admin/pedidos/${o.id}`}>
                      <ExternalLink className="h-4 w-4" /> Abrir pedido
                    </Link>
                  </Button>
                  {receivable && o.overdue && o.chargeMessage && (
                    <ChargeDialog
                      orderId={o.id}
                      orderNumber={o.number}
                      customerName={o.customerName ?? null}
                      hasPhone={!!o.phone}
                      defaultMessage={o.chargeMessage}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
