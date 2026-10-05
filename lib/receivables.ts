import "server-only";
import { chargeMessageText } from "@/lib/whatsapp";
import { amountDue, isOverdue } from "@/lib/order-utils";
import { site } from "@/lib/site";
import type { ReceivableItem } from "@/components/admin/receivables-panel";
import type { Order } from "@/lib/types";

/** Venda na loja ainda não paga = conta a receber (alvo de cobrança). */
export const isReceivable = (o: Order) => o.channel === "pos" && o.status === "pending";

export const toReceivable = (o: Order): ReceivableItem => ({
  id: o.id,
  number: o.number,
  customerName: o.customer_name,
  phone: o.phone,
  total: amountDue(o),
  fullTotal: o.total,
  cashPaid: o.cash_paid,
  payUrl: `${site.url}/pagar/${o.id}`,
  created_at: o.created_at,
  overdue: isOverdue(o.created_at),
  defaultMessage: chargeMessageText(o, `${site.url}/pagar/${o.id}`),
});
