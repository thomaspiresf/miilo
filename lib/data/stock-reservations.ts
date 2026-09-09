import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";

/**
 * Reserva de estoque no checkout: o estoque baixa quando o pedido é criado e
 * volta se o cliente não pagar em ~1h. Esta rotina devolve as reservas vencidas.
 *
 * O plano Hobby da Vercel só permite cron 1x/dia, então em vez de cron a gente
 * roda essa varredura de leve nas rotas com tráfego (catálogo + checkout),
 * no máximo uma vez por minuto.
 */

const RESERVATION_MINUTES = 65; // Pix expira em 60min; folga de 5min

let lastSweep = 0;
let sweeping = false;

async function sweepSupabase(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_stale_reservations", {
    p_minutes: RESERVATION_MINUTES,
  });
  if (error) {
    // migração ainda não rodou — ignora
    if (!/expire_stale_reservations|schema cache|does not exist/i.test(error.message)) {
      console.error("sweepExpiredReservations", error);
    }
    return 0;
  }
  return Number(data ?? 0);
}

function sweepMock(): number {
  const db = mockDB();
  const cutoff = Date.now() - RESERVATION_MINUTES * 60_000;
  let n = 0;
  for (const order of db.orders) {
    if (
      order.status === "pending" &&
      order.channel !== "pos" &&
      order.stock_reserved &&
      !order.stock_restored &&
      new Date(order.created_at).getTime() < cutoff
    ) {
      order.stock_restored = true;
      order.status = "cancelled";
      order.mp_status = order.mp_status ?? "expired";
      for (const item of order.items) {
        const product = db.products.find((p) =>
          p.variants.some((v) => v.id === item.variant_id),
        );
        const variant = product?.variants.find((v) => v.id === item.variant_id);
        if (variant && product) {
          variant.stock += item.qty;
          product.in_stock = product.variants.some((v) => v.stock > 0);
        }
      }
      n += 1;
    }
  }
  return n;
}

/** Devolve reservas vencidas. Sempre roda (usar no checkout). */
export async function sweepExpiredReservations(): Promise<number> {
  try {
    return hasSupabaseAdmin() ? await sweepSupabase() : sweepMock();
  } catch (err) {
    console.error("sweepExpiredReservations", err);
    return 0;
  }
}

/** Igual, mas no máximo 1x/minuto e sem travar quem chamou (fire-and-forget). */
export function maybeSweepReservations(): void {
  const now = Date.now();
  if (sweeping || now - lastSweep < 60_000) return;
  sweeping = true;
  lastSweep = now;
  void sweepExpiredReservations().finally(() => {
    sweeping = false;
  });
}
