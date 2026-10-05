/** Regras de valor de pedido compartilhadas entre servidor e telas (sem dependência de servidor). */

type Amounts = { total: number; cash_paid?: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parte já recebida na loja (dinheiro/maquininha) antes do link de pagamento. */
export const cashPaidOf = (o: Amounts): number => round2(Math.min(Math.max(0, o.cash_paid ?? 0), o.total));

/** Quanto ainda falta pagar num pedido pendente (o valor que o link Pix/cartão cobra). */
export const amountDue = (o: Amounts): number => round2(o.total - cashPaidOf(o));

/**
 * O que já entrou de dinheiro de um pedido: pago = líquido (ou total); venda na
 * loja pendente = só a parte já recebida em dinheiro; o resto = 0.
 */
export function receivedSoFar(o: Amounts & { status: string; channel: string; net_amount?: number | null }): number {
  if (["paid", "shipped", "delivered"].includes(o.status)) return o.net_amount ?? o.total;
  if (o.channel === "pos" && o.status === "pending") return cashPaidOf(o);
  return 0;
}
