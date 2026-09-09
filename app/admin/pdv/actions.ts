"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { posOrderSchema, type PosOrderInput } from "@/lib/pos-schema";
import {
  createOrder,
  approveOrder,
  getOrderById,
  adminDeleteOrder,
} from "@/lib/data/orders";
import { logAction } from "@/lib/data/audit";
import { formatBRL } from "@/lib/format";
import { site } from "@/lib/site";

/** E-mail usado quando a venda na loja é anônima (o MP exige um e-mail no pagador). */
const POS_FALLBACK_EMAIL = "venda-loja@miilo.com.br";

type PosOrderResult =
  | { error: string }
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      paid: boolean;
      payUrl: string | null;
    };

export async function createPosOrder(raw: PosOrderInput): Promise<PosOrderResult> {
  await requireAdmin();

  const parsed = posOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { customerName, phone, email, payMode, lines, discount } = parsed.data;

  try {
    const order = await createOrder({
      email: email || POS_FALLBACK_EMAIL,
      name: customerName || "Cliente da loja",
      phone,
      userId: null,
      deliveryMode: "pickup",
      address: null,
      shipping: { company: "", service: "Venda na loja", price: 0 },
      lines,
      channel: "pos",
      discount: discount || 0,
    });

    if (payMode === "cash") {
      await approveOrder(order.id, { mpStatus: "manual", method: "dinheiro" });
    }

    await logAction({
      action: "pos.sale",
      entity: "order",
      entityId: order.id,
      summary: `Venda na loja ${order.number} — ${formatBRL(order.total)} ${
        payMode === "cash" ? "(dinheiro/maquininha, pago)" : "(link de pagamento)"
      }`,
    });

    revalidatePath("/admin/pdv");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      total: order.total,
      paid: payMode === "cash",
      payUrl: payMode === "cash" ? null : `${site.url}/pagar/${order.id}`,
    };
  } catch (err) {
    console.error("createPosOrder", err);
    return { error: err instanceof Error ? err.message : "Falha ao registrar a venda" };
  }
}

/**
 * Descarta uma venda recém-criada que ainda não foi paga (pra corrigir e
 * refazer — ex.: esqueceu um item). Só apaga pedido PDV pendente.
 */
export async function discardPosOrder(orderId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const order = await getOrderById(orderId);
  if (!order || order.channel !== "pos" || order.status !== "pending") {
    return { ok: false };
  }
  await adminDeleteOrder(orderId);
  await logAction({
    action: "pos.discard",
    entity: "order",
    entityId: orderId,
    summary: `Descartou a venda na loja ${order.number} (não paga)`,
  });
  revalidatePath("/admin/pdv");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true };
}
