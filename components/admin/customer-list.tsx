"use client";

import { useState } from "react";
import { ChevronDown, Mail, Phone, UserRound } from "lucide-react";
import { formatBRL, formatDate, formatWhatsAppPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderList, type OrderListItem } from "@/components/admin/order-list";

export type CustomerListItem = {
  key: string;
  name: string;
  phones: string[];
  emails: string[];
  anonymous: boolean;
  lastAt: string;
  received: number;
  due: number;
  orders: OrderListItem[];
};

/** Pedidos juntados por cliente: um cartão por pessoa, com totais e os pedidos dentro. */
export function CustomerList({ customers, empty = "Nenhum cliente." }: { customers: CustomerListItem[]; empty?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  if (customers.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{empty}</p>
    );
  }

  return (
    <div className="space-y-2">
      {customers.map((c) => {
        const isOpen = open.has(c.key);
        return (
          <div key={c.key} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <button
              type="button"
              onClick={() => toggle(c.key)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.05] text-muted">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs font-normal text-muted">
                    {c.orders.length} pedido{c.orders.length === 1 ? "" : "s"} · último em {formatDate(c.lastAt)}
                  </span>
                </span>
                {(c.phones.length > 0 || c.emails.length > 0) && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {c.phones.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {formatWhatsAppPhone(`55${p}`)}
                      </span>
                    ))}
                    {c.emails.map((e) => (
                      <span key={e} className="inline-flex min-w-0 items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{e}</span>
                      </span>
                    ))}
                  </span>
                )}
                {c.anonymous && (
                  <span className="mt-0.5 block text-xs text-muted">
                    Vendas na loja sem nome nem contato — não dá pra saber de quem são.
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span className="text-sm font-bold tabular-nums">{formatBRL(c.received)}</span>
                <span className="text-[11px] text-muted">recebido</span>
                {c.due > 0 && (
                  <span className="text-[11px] font-semibold tabular-nums text-warning">{formatBRL(c.due)} a receber</span>
                )}
              </span>
              <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="border-t border-border bg-black/[0.015] p-2">
                <OrderList orders={c.orders} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
