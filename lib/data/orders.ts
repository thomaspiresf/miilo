import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAdmin, hasSupabase } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { imageUrl } from "@/lib/data/catalog";
import type { DeliveryMode, Order, OrderStatus, ShippingOption } from "@/lib/types";

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
};

type ResolvedLine = {
  variantId: string;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
  imageUrl: string | null;
  stock: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// --------------------------------------------------------------------------
//  Resolve preço/estoque/nome das variações a partir do banco (fonte da verdade)
// --------------------------------------------------------------------------
async function resolveLines(lines: NewOrderLine[]): Promise<ResolvedLine[]> {
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
      };
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, size, color, price, stock, active, product:products(name, images:product_images(storage_path, sort))",
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
  const subtotal = round2(
    resolved.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const shippingCost = pickup ? 0 : round2(input.shipping.price);
  const total = round2(subtotal + shippingCost);
  const shippingService = pickup
    ? "Retirada na loja"
    : `${input.shipping.company} ${input.shipping.service}`.trim();
  const address = pickup ? null : input.address;

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
      status: "pending",
      subtotal,
      shipping_cost: shippingCost,
      shipping_service: shippingService,
      total,
      address,
      mp_payment_id: null,
      mp_status: null,
      payment_method: null,
      tracking_code: null,
      stock_restored: false,
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
  let ins = await admin
    .from("orders")
    .insert({
      ...baseRow,
      customer_name: input.name,
      phone: input.phone,
      delivery_mode: input.deliveryMode,
    })
    .select("*")
    .single();

  // fallback se a migração migration-checkout.sql ainda não foi aplicada
  if (ins.error && /column .* does not exist|schema cache/i.test(ins.error.message)) {
    ins = await admin.from("orders").insert(baseRow).select("*").single();
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
  if (itemsError) throw itemsError;

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
    status: row.status,
    subtotal: Number(row.subtotal),
    shipping_cost: Number(row.shipping_cost),
    shipping_service: row.shipping_service ?? null,
    total: Number(row.total),
    address: row.address ?? null,
    mp_payment_id: row.mp_payment_id ?? null,
    mp_status: row.mp_status ?? null,
    payment_method: row.payment_method ?? null,
    tracking_code: row.tracking_code ?? null,
    stock_restored: row.stock_restored ?? false,
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

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  if (!hasSupabase()) return mockDB().orders;
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const orders: Order[] = [];
  for (const row of rows ?? []) {
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", row.id);
    orders.push(mapOrder(row, items ?? []));
  }
  return orders;
}

export async function listAllOrders(status?: OrderStatus): Promise<Order[]> {
  if (!hasSupabaseAdmin()) {
    const all = mockDB().orders;
    return status ? all.filter((o) => o.status === status) : all;
  }
  const admin = createAdminClient();
  let q = admin.from("orders").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: rows } = await q;
  const orders: Order[] = [];
  for (const row of rows ?? []) {
    const { data: items } = await admin
      .from("order_items")
      .select("*")
      .eq("order_id", row.id);
    orders.push(mapOrder(row, items ?? []));
  }
  return orders;
}

// --------------------------------------------------------------------------
//  Mutação de status
// --------------------------------------------------------------------------
/** Aplica uma variação de estoque no mock e registra a movimentação. */
function mockMoveStock(
  variantId: string | null,
  delta: number,
  reason: "sale" | "cancellation" | "adjustment" | "restock",
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
    for (const item of order.items) {
      mockMoveStock(item.variant_id, -item.qty, "sale", order.id);
    }
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_order", {
    p_order_id: id,
    p_mp_payment_id: opts.mpPaymentId ?? null,
    p_mp_status: opts.mpStatus ?? "approved",
    p_method: opts.method ?? null,
  });
  if (error) throw error;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  extra: { mpStatus?: string; mpPaymentId?: string | null; trackingCode?: string | null } = {},
): Promise<void> {
  // status onde o estoque já foi baixado — cancelar deve devolver
  const STOCK_TAKEN = ["paid", "shipped", "delivered"];

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const order = db.orders.find((o) => o.id === id);
    if (!order) return;

    if (
      status === "cancelled" &&
      STOCK_TAKEN.includes(order.status) &&
      !order.stock_restored
    ) {
      order.stock_restored = true;
      for (const item of order.items) {
        mockMoveStock(item.variant_id, item.qty, "cancellation", order.id);
      }
    }

    order.status = status;
    if (extra.mpStatus) order.mp_status = extra.mpStatus;
    if (extra.mpPaymentId) order.mp_payment_id = extra.mpPaymentId;
    if (extra.trackingCode !== undefined) order.tracking_code = extra.trackingCode;
    return;
  }

  const admin = createAdminClient();

  if (status === "cancelled") {
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
