import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { normalizeCode, type CouponInput } from "@/lib/coupon-schema";
import type { Coupon } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MISSING_TABLE = /relation .* does not exist|could not find the table|schema cache/i;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mapCoupon(row: any): Coupon {
  return {
    id: row.id,
    code: row.code,
    percent_off: Number(row.percent_off),
    min_subtotal: row.min_subtotal != null ? Number(row.min_subtotal) : null,
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    uses_count: Number(row.uses_count ?? 0),
    expires_at: row.expires_at ?? null,
    active: row.active !== false,
    created_at: row.created_at,
  };
}

export type CouponStatus = "ativo" | "inativo" | "vencido" | "esgotado";

/** Situação atual de um cupom (pra exibir no admin). */
export function couponStatus(c: Coupon): CouponStatus {
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return "vencido";
  if (c.max_uses != null && c.uses_count >= c.max_uses) return "esgotado";
  return c.active ? "ativo" : "inativo";
}

function assertPersistable() {
  if (hasSupabase() && !hasSupabaseAdmin()) {
    throw new Error(
      "Configure SUPABASE_SERVICE_ROLE_KEY (chave sb_secret_…) para salvar cupons.",
    );
  }
}

// --------------------------------------------------------------------------
//  Validação no checkout — fonte da verdade do desconto
// --------------------------------------------------------------------------
export type CouponCheck =
  | { ok: true; code: string; percentOff: number; discount: number }
  | { ok: false; error: string };

/** Valida um cupom contra um subtotal e devolve o desconto em reais. */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
): Promise<CouponCheck> {
  const code = normalizeCode(rawCode || "");
  if (!code) return { ok: false, error: "Informe um código." };

  const coupon = await findCoupon(code);
  if (!coupon || !coupon.active) return { ok: false, error: "Cupom inválido." };

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Este cupom expirou." };
  }
  if (coupon.max_uses != null && coupon.uses_count >= coupon.max_uses) {
    return { ok: false, error: "Este cupom atingiu o limite de usos." };
  }
  if (coupon.min_subtotal != null && subtotal < coupon.min_subtotal) {
    return {
      ok: false,
      error: `Válido em compras acima de ${brl(coupon.min_subtotal)}.`,
    };
  }

  const discount = Math.min(
    round2((subtotal * coupon.percent_off) / 100),
    round2(subtotal),
  );
  if (discount <= 0) return { ok: false, error: "Cupom não aplicável." };

  return { ok: true, code: coupon.code, percentOff: coupon.percent_off, discount };
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function findCoupon(code: string): Promise<Coupon | null> {
  if (!hasSupabaseAdmin()) {
    return mockDB().coupons.find((c) => c.code.toUpperCase() === code) ?? null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .ilike("code", code)
    .maybeSingle();
  if (error) {
    if (MISSING_TABLE.test(error.message)) return null; // migração ainda não rodou
    throw error;
  }
  return data ? mapCoupon(data) : null;
}

/** Marca um uso do cupom (chamado quando o pedido é aprovado). Nunca lança. */
export async function incrementCouponUse(code: string | null | undefined) {
  if (!code) return;
  const norm = normalizeCode(code);
  try {
    if (!hasSupabaseAdmin()) {
      const c = mockDB().coupons.find((x) => x.code.toUpperCase() === norm);
      if (c) c.uses_count += 1;
      return;
    }
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_coupon_use", { p_code: norm });
    if (error && !MISSING_TABLE.test(error.message)) {
      // fallback sem RPC
      const { data } = await admin
        .from("coupons")
        .select("id, uses_count")
        .ilike("code", norm)
        .maybeSingle();
      if (data) {
        await admin
          .from("coupons")
          .update({ uses_count: Number(data.uses_count ?? 0) + 1 })
          .eq("id", data.id);
      }
    }
  } catch (err) {
    console.error("incrementCouponUse", err);
  }
}

// --------------------------------------------------------------------------
//  Admin
// --------------------------------------------------------------------------
export async function listCoupons(): Promise<Coupon[]> {
  if (!hasSupabaseAdmin()) {
    return [...mockDB().coupons].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (MISSING_TABLE.test(error.message)) return [];
    throw error;
  }
  return (data ?? []).map(mapCoupon);
}

export async function adminCreateCoupon(input: CouponInput): Promise<void> {
  assertPersistable();
  const row = {
    code: input.code,
    percent_off: input.percentOff,
    min_subtotal: input.minSubtotal,
    max_uses: input.maxUses,
    expires_at: input.expiresAt ? `${input.expiresAt}T23:59:59` : null,
    active: input.active,
  };

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    if (db.coupons.some((c) => c.code === input.code)) {
      throw new Error("Já existe um cupom com esse código.");
    }
    db.coupons.push({
      id: crypto.randomUUID(),
      ...row,
      uses_count: 0,
      created_at: new Date().toISOString(),
    });
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("coupons").insert(row);
  if (error) {
    if ((error as any).code === "23505") throw new Error("Já existe um cupom com esse código.");
    if (MISSING_TABLE.test(error.message)) {
      throw new Error("Rode a migração supabase/migration-coupons.sql primeiro.");
    }
    throw error;
  }
}

export async function adminSetCouponActive(id: string, active: boolean): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    const c = mockDB().coupons.find((x) => x.id === id);
    if (c) c.active = active;
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.from("coupons").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    db.coupons = db.coupons.filter((c) => c.id !== id);
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.from("coupons").delete().eq("id", id);
  if (error) throw error;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
