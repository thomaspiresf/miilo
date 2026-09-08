import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS: Record<
  OrderStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "primary" }
> = {
  pending: { label: "Aguardando pagamento", tone: "warning" },
  paid: { label: "Pagamento aprovado", tone: "success" },
  failed: { label: "Pagamento não aprovado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "danger" },
  shipped: { label: "Enviado", tone: "primary" },
  delivered: { label: "Entregue", tone: "success" },
};
