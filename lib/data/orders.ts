import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAdmin, hasSupabase } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { imageUrl } from "@/lib/data/catalog";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { incrementCouponUse } from "@/lib/data/coupons";
import type {
  DeliveryMode,
  Order,
  OrderChannel,
  OrderStatus,
  ShippingOption,
} from "@/lib/types";

export type NewOrderLine = { variantId: string; qty: number };

export type NewOrderInput = {
  email: string;
  name: string;
  phone: string | null;
  userId: string | null;
  deliveryMode: DeliveryMode;
  address: Order["address"];
  shipping: Pick<ShippingOption, "company" | "service" | "price">;
  lines: NewOrderLine[];
  /** "pos" para vendas presenciais no /admin/pdv. Padrão: "online". */
  channel?: OrderChannel;
  /** Desconto de cupom já validado no servidor (em reais). */
  discount?: number;
  couponCode?: string | null;
  /** Observação livre do vendedor (venda na loja). */
  notes?: string | null;
  /** Como a venda na loja foi lançada: link | now | cash | later. */
  posPayMode?: string | null;
};

export type ResolvedLine = {
  variantId: string;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
  imageUrl: string | null;
  stock: number;
  weightGrams: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------------------------------------------------------------------
//  Resolve preço/estoque/nome das variações a partir do banco (fonte da verdade)
// --------------------------------------------------------------------------
/** Subtotal (preços reais do banco) de um conjunto de linhas do carrinho. */
export async function resolveSubtotal(lines: NewOrderLine[]): Promise<number> {
  const resolved = await resolveLines(lines);
  return round2(resolved.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
}

/** Junta linhas repetidas do mesmo variantId (evita furar a checagem de estoque). */
function mergeLines(lines: NewOrderLine[]): NewOrderLine[] {
  const byId = new Map<string, number>();
  for (const l of lines) {
    byId.set(l.variantId, (byId.get(l.variantId) ?? 0) + l.qty);
  }
  return [...byId].map(([variantId, qty]) => ({ variantId, qty }));
}

export async function resolveLines(rawLines: NewOrderLine[]): Promise<ResolvedLine[]> {
  const lines = mergeLines(rawLines);
  const ids = lines.map((l) => l.variantId);

  if (!hasSupabase()) {
    return lines.map((l) => {
      const product = mockDB().products.find((p) =>
        p.variants.some((v) => v.id === l.variantId),
      );
      const variant = product?.variants.find((v) => v.id === l.variantId);
      if (!product || !variant) throw new Error(`Variação ${l.variantId} não encontrada`);
      return {
        variantId: variant.id,
        productName: product.name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(" · ") || null,
        unitPrice: variant.price,
        qty: l.qty,
        imageUrl: product.images[0]?.url ?? null,
        stock: variant.stock,
        weightGrams: variant.weight_grams || 300,
      };
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, size, color, price, stock, active, weight_grams, product:products(name, images:product_images(storage_path, sort))",
    )
    .in("id", ids);
  if (error) throw error;

  return lines.map((l) => {
    const v: any = (data ?? []).find((row: any) => row.id === l.variantId);
    if (!v || v.active === false) throw new Error(`Variação ${l.variantId} indisponível`);
    const firstImage = (v.product?.images ?? []).sort(
      (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0),
    )[0];
    return {
      variantId: v.id,
      productName: v.product?.name ?? "Produto",
      variantLabel: [v.size, v.color].filter(Boolean).join(" · ") || null,
      unitPrice: Number(v.price),
      qty: l.qty,
      imageUrl: firstImage ? imageUrl(firstImage.storage_path) : null,
      stock: Number(v.stock ?? 0),
      weightGrams: Number(v.weight_grams) || 300,
    };
  });
}

// --------------------------------------------------------------------------
//  Criar pedido (status pending). Totais recalculados no servidor.
// --------------------------------------------------------------------------
export async function createOrder(input: NewOrderInput): Promise<Order> {
  const resolved = await resolveLines(input.lines);

  for (const line of resolved) {
    if (line.qty < 1) throw new Error("Quantidade inválida");
    if (line.stock < line.qty)
      throw new Error(`Estoque insuficiente para ${line.productName}`);
  }

  const pickup = input.deliveryMode === "pickup";
  const channel: OrderChannel = input.channel === "pos" ? "pos" : "online";
  const subtotal = round2(
    resolved.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const shippingCost = pickup ? 0 : round2(input.shipping.price);
  const discount = Math.min(round2(Math.max(0, input.discount ?? 0)), subtotal);
  const couponCode = discount > 0 ? (input.couponCode ?? null) : null;
  const total = round2(subtotal - discount + shippingCost);
  const shippingService = pickup
    ? "Retirada na loja"
    : `${input.shipping.company} ${input.shipping.service}`.trim();
  const address = pickup ? null : input.address;
  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 500) : null;
  const posPayMode =
    channel === "pos" && input.posPayMode ? input.posPayMode : null;

  // ---- modo demonstração ----
  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const seq = 1000 + db.orders.length + 1;
    const order: Order = {
      id: crypto.randomUUID(),
      number: `MI-${String(seq).padStart(6, "0")}`,
      user_id: input.userId,
      email: input.email,
      customer_name: input.name,
      phone: input.phone,
      delivery_mode: input.deliveryMode,
      channel,
      status: "pending",
      subtotal,
      shipping_cost: shippingCost,
      shipping_service: shippingService,
      total,
      discount,
      coupon_code: couponCode,
      address,
      mp_payment_id: null,
      mp_status: null,
      payment_method: null,
      tracking_code: null,
      notes,
      pos_pay_mode: posPayMode,
      stock_restored: false,
      stock_reserved: true,
      created_at: new Date().toISOString(),
      items: resolved.map((l) => ({
        id: crypto.randomUUID(),
        variant_id: l.variantId,
        product_name: l.productName,
        variant_label: l.variantLabel,
        unit_price: l.unitPrice,
        qty: l.qty,
        image_url: l.imageUrl,
      })),
    };
    db.orders.unshift(order);
    // reserva: baixa o estoque já na criação
    for (const item of order.items) {
      mockMoveStock(item.variant_id, -item.qty, "reservation", order.id);
    }
    return order;
  }

  // ---- Supabase ----
  const admin = createAdminClient();
  const baseRow = {
    user_id: input.userId,
    email: input.email,
    status: "pending",
    subtotal,
    shipping_cost: shippingCost,
    shipping_service: shippingService,
    total,
    address,
  };
  // Tenta com todas as colunas; se alguma migração ainda não foi aplicada,
  // vai removendo campos até o insert passar (channel -> trio do checkout).
  const coupon = discount > 0 ? { discount, coupon_code: couponCode } : {};
  const note = notes ? { notes } : {};
  const posMode = posPayMode ? { pos_pay_mode: posPayMode } : {};
  const full = {
    ...baseRow,
    customer_name: input.name,
    phone: input.phone,
    delivery_mode: input.deliveryMode,
    channel,
  };
  const rowAttempts = [
    { ...full, ...coupon, ...note, ...posMode },
    { ...full, ...coupon, ...note },
    { ...full, ...coupon },
    full,
    {
      ...baseRow,
      customer_name: input.name,
      phone: input.phone,
      delivery_mode: input.deliveryMode,
    },
    baseRow,
  ];
  const missingColumn = /column .* does not exist|schema cache|could not find/i;
  let ins = await admin.from("orders").insert(rowAttempts[0]).select("*").single();
  for (let i = 1; i < rowAttempts.length && ins.error && missingColumn.test(ins.error.message); i++) {
    ins = await admin.from("orders").insert(rowAttempts[i]).select("*").single();
  }
  if (ins.error) throw ins.error;
  const orderRow = ins.data;

  const { error: itemsError } = await admin.from("order_items").insert(
    resolved.map((l) => ({
      order_id: orderRow.id,
      variant_id: l.variantId,
      product_name: l.productName,
      variant_label: l.variantLabel,
      unit_price: l.unitPrice,
      qty: l.qty,
      image_url: l.imageUrl,
    })),
  );
  if (itemsError) {
    await admin.from("orders").delete().eq("id", orderRow.id);
    throw itemsError;
  }

  // Reserva o estoque de forma atômica. Se faltar, a função levanta
  // OUT_OF_STOCK:<produto> — desfazemos o pedido e devolvemos um erro claro.
  const { error: reserveError } = await admin.rpc("reserve_order_stock", {
    p_order_id: orderRow.id,
  });
  if (reserveError) {
    const oos = /OUT_OF_STOCK:(.+)$/.exec(reserveError.message);
    if (oos) {
      await admin.from("orders").delete().eq("id", orderRow.id);
      throw new Error(`Estoque insuficiente para ${oos[1].trim()}`);
    }
    // Migração ainda não rodou: segue sem reserva (estoque baixa na aprovação,
    // comportamento antigo). Qualquer outro erro é propagado.
    const notMigrated =
      /reserve_order_stock.*does not exist|could not find the function|schema cache/i.test(
        reserveError.message,
      );
    if (!notMigrated) {
      await admin.from("orders").delete().eq("id", orderRow.id);
      throw reserveError;
    }
  }

  return getOrderById(orderRow.id) as Promise<Order>;
}

// --------------------------------------------------------------------------
//  Leitura
// --------------------------------------------------------------------------
function mapOrder(row: any, items: any[]): Order {
  return {
    id: row.id,
    number: row.number,
    user_id: row.user_id ?? null,
    email: row.email,
    customer_name: row.customer_name ?? null,
    phone: row.phone ?? null,
    delivery_mode: row.delivery_mode === "pickup" ? "pickup" : "delivery",
    channel: row.channel === "pos" ? "pos" : "online",
    status: row.status,
    subtotal: Number(row.subtotal),
    shipping_cost: Number(row.shipping_cost),
    shipping_service: row.shipping_service ?? null,
    total: Number(row.total),
    discount: Number(row.discount ?? 0),
    coupon_code: row.coupon_code ?? null,
    address: row.address ?? null,
    mp_payment_id: row.mp_payment_id ?? null,
    mp_status: row.mp_status ?? null,
    payment_method: row.payment_method ?? null,
    tracking_code: row.tracking_code ?? null,
    notes: row.notes ?? null,
    pos_pay_mode: row.pos_pay_mode ?? null,
    stock_restored: row.stock_restored ?? false,
    stock_reserved: row.stock_reserved ?? false,
    created_at: row.created_at,
    items: (items ?? []).map((it: any) => ({
      id: it.id,
      variant_id: it.variant_id,
      product_name: it.product_name,
      variant_label: it.variant_label ?? null,
      unit_price: Number(it.unit_price),
      qty: it.qty,
      image_url: it.image_url ?? null,
    })),
  };
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!hasSupabaseAdmin()) {
    return mockDB().orders.find((o) => o.id === id) ?? null;
  }
  const admin = createAdminClient();
  const { data: row } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("order_id", id);
  return mapOrder(row, items ?? []);
}

/** Junta as linhas de vários pedidos numa consulta só (evita N+1). */
async function fetchOrders(db: any, rows: any[]): Promise<Order[]> {
  if (rows.length === 0) return [];
  const { data: allItems } = await db
    .from("order_items")
    .select("*")
    .in(
      "order_id",
      rows.map((r: any) => r.id),
    );
  const byOrder = new Map<string, any[]>();
  for (const it of allItems ?? []) {
    const arr = byOrder.get(it.order_id);
    if (arr) arr.push(it);
    else byOrder.set(it.order_id, [it]);
  }
  return rows.map((row) => mapOrder(row, byOrder.get(row.id) ?? []));
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  if (!hasSupabase()) return mockDB().orders;
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return fetchOrders(supabase, rows ?? []);
}

export const listAllOrders = cache(
  async (status?: OrderStatus): Promise<Order[]> => {
    if (!hasSupabaseAdmin()) {
      const all = mockDB().orders;
      return status ? all.filter((o) => o.status === status) : all;
    }
    const admin = createAdminClient();
    let q = admin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data: rows } = await q;
    return fetchOrders(admin, rows ?? []);
  },
);

// --------------------------------------------------------------------------
//  Mutação de status
// --------------------------------------------------------------------------
/** Aplica uma variação de estoque no mock e registra a movimentação. */
function mockMoveStock(
  variantId: string | null,
  delta: number,
  reason:
    | "sale"
    | "cancellation"
    | "adjustment"
    | "restock"
    | "reservation"
    | "reservation_release",
  orderId: string | null,
) {
  if (!variantId) return;
  const db = mockDB();
  const product = db.products.find((p) => p.variants.some((v) => v.id === variantId));
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!variant || !product) return;
  variant.stock = Math.max(0, variant.stock + delta);
  product.in_stock = product.variants.some((v) => v.stock > 0);
  db.movements.unshift({
    id: crypto.randomUUID(),
    variant_id: variantId,
    delta,
    reason,
    note: null,
    order_id: orderId,
    balance_after: variant.stock,
    created_at: new Date().toISOString(),
    product_name: product.name,
    variant_label: [variant.size, variant.color].filter(Boolean).join(" · ") || null,
  });
}

/**
 * Uma venda mexe no estoque — limpa o cache das páginas públicas (home + produto
 * são ISR de 60s) pra "Esgotado" aparecer na hora. Fora de contexto de request
 * (não deve acontecer), o try/catch evita quebrar o fluxo do pedido.
 */
function revalidateStorefrontStock() {
  try {
    revalidatePath("/");
    revalidatePath("/c/[slug]", "page");
    revalidatePath("/p/[slug]", "page");
  } catch {
    /* chamado fora de um request — ISR cobre em até 60s */
  }
}

export async function approveOrder(
  id: string,
  opts: { mpPaymentId?: string | null; mpStatus?: string; method?: string | null } = {},
): Promise<void> {
  if (!hasSupabaseAdmin()) {
    const order = mockDB().orders.find((o) => o.id === id);
    if (!order || order.status === "paid") return;
    order.status = "paid";
    order.mp_payment_id = opts.mpPaymentId ?? order.mp_payment_id;
    order.mp_status = opts.mpStatus ?? "approved";
    order.payment_method = opts.method ?? order.payment_method;
    if (order.stock_reserved && !order.stock_restored) {
      // estoque já baixado na reserva — só converte o histórico
      for (const mv of mockDB().movements) {
        if (mv.order_id === order.id && mv.reason === "reservation") mv.reason = "sale";
      }
    } else {
      for (const item of order.items) {
        mockMoveStock(item.variant_id, -item.qty, "sale", order.id);
      }
    }
    await incrementCouponUse(order.coupon_code);
    await sendOrderConfirmationEmail(order);
    revalidateStorefrontStock();
    return;
  }
  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const wasPaid = prev?.status === "paid";

  const { error } = await admin.rpc("approve_order", {
    p_order_id: id,
    p_mp_payment_id: opts.mpPaymentId ?? null,
    p_mp_status: opts.mpStatus ?? "approved",
    p_method: opts.method ?? null,
  });
  if (error) throw error;

  revalidateStorefrontStock();

  if (wasPaid) return; // já estava pago — não conta cupom nem reenvia e-mail

  const fresh = await getOrderById(id);
  if (fresh && fresh.status === "paid") {
    await incrementCouponUse(fresh.coupon_code);
    await sendOrderConfirmationEmail(fresh);
  }
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  extra: { mpStatus?: string; mpPaymentId?: string | null; trackingCode?: string | null } = {},
): Promise<void> {
  // status onde o estoque já foi baixado — cancelar deve devolver
  const STOCK_TAKEN = ["paid", "shipped", "delivered"];

  const RELEASES_STOCK = ["cancelled", "failed"];

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const order = db.orders.find((o) => o.id === id);
    if (!order) return;

    if (RELEASES_STOCK.includes(status) && !order.stock_restored) {
      if (STOCK_TAKEN.includes(order.status)) {
        // pedido pago cancelado — devolve a venda
        order.stock_restored = true;
        for (const item of order.items) {
          mockMoveStock(item.variant_id, item.qty, "cancellation", order.id);
        }
      } else if (order.stock_reserved) {
        // reserva que não virou venda — devolve
        order.stock_restored = true;
        for (const item of order.items) {
          mockMoveStock(item.variant_id, item.qty, "reservation_release", order.id);
        }
      }
    }

    order.status = status;
    if (extra.mpStatus) order.mp_status = extra.mpStatus;
    if (extra.mpPaymentId) order.mp_payment_id = extra.mpPaymentId;
    if (extra.trackingCode !== undefined) order.tracking_code = extra.trackingCode;
    return;
  }

  const admin = createAdminClient();

  if (RELEASES_STOCK.includes(status)) {
    // devolve a reserva de um pedido pendente que não foi pago (no-op se não houver)
    await admin.rpc("release_order_stock", { p_order_id: id }).then(
      () => {},
      () => {},
    );

    // lê o estado atual (com fallback se a coluna stock_restored não existir)
    let curStatus: string | null = null;
    let restored = false;
    const withFlag = await admin
      .from("orders")
      .select("status, stock_restored")
      .eq("id", id)
      .maybeSingle();
    if (withFlag.error) {
      const basic = await admin.from("orders").select("status").eq("id", id).maybeSingle();
      curStatus = (basic.data?.status as string) ?? null;
    } else {
      curStatus = (withFlag.data?.status as string) ?? null;
      restored = Boolean(withFlag.data?.stock_restored);
    }

    if (curStatus && !restored && STOCK_TAKEN.includes(curStatus)) {
      const { error: rpcErr } = await admin.rpc("restock_order", { p_order_id: id });
      if (rpcErr) {
        // migração de estoque ainda não aplicada — devolve inline
        const { data: items } = await admin
          .from("order_items")
          .select("variant_id, qty")
          .eq("order_id", id);
        for (const it of items ?? []) {
          if (!it.variant_id) continue;
          const { data: v } = await admin
            .from("product_variants")
            .select("stock")
            .eq("id", it.variant_id)
            .single();
          await admin
            .from("product_variants")
            .update({ stock: (v?.stock ?? 0) + it.qty })
            .eq("id", it.variant_id);
        }
        await admin
          .from("orders")
          .update({ stock_restored: true })
          .eq("id", id)
          .then(() => {}, () => {}); // ignora se a coluna não existir
      }
    }
  }

  const patch: Record<string, unknown> = { status };
  if (extra.mpStatus) patch.mp_status = extra.mpStatus;
  if (extra.mpPaymentId) patch.mp_payment_id = extra.mpPaymentId;
  if (extra.trackingCode !== undefined) patch.tracking_code = extra.trackingCode;
  const { error } = await admin.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Apaga um pedido de vez (qualquer admin). Se o estoque já tinha sido baixado,
 * devolve antes (via o mesmo caminho do cancelamento). order_items somem junto
 * (cascade); stock_movements e payment_events ficam com order_id nulo.
 */
export async function adminDeleteOrder(id: string): Promise<void> {
  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const order = db.orders.find((o) => o.id === id);
    if (!order) return;
    // devolve venda ou reserva (idempotente), depois apaga
    await setOrderStatus(id, "cancelled");
    db.orders = db.orders.filter((o) => o.id !== id);
    return;
  }
  // devolve estoque se necessário (idempotente), depois apaga
  await setOrderStatus(id, "cancelled");
  const admin = createAdminClient();
  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) throw error;
}

// --------------------------------------------------------------------------
//  Idempotência de webhook
// --------------------------------------------------------------------------
export async function recordPaymentEvent(evt: {
  orderId: string | null;
  mpPaymentId: string | null;
  type: string;
  status: string;
  raw: unknown;
}): Promise<boolean> {
  // retorna true se é um evento novo (deve ser processado)
  if (!hasSupabaseAdmin()) return true;
  const admin = createAdminClient();
  const { error } = await admin.from("payment_events").insert({
    order_id: evt.orderId,
    mp_payment_id: evt.mpPaymentId,
    type: evt.type,
    status: evt.status,
    raw: evt.raw as any,
  });
  // violação de índice único = evento já processado
  if (error && (error as any).code === "23505") return false;
  if (error) throw error;
  return true;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
