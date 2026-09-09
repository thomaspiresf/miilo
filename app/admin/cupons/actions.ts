"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { couponInputSchema } from "@/lib/coupon-schema";
import {
  adminCreateCoupon,
  adminDeleteCoupon,
  adminSetCouponActive,
  listCoupons,
} from "@/lib/data/coupons";
import { logAction } from "@/lib/data/audit";

export async function createCouponAction(_prev: unknown, formData: FormData) {
  await requireAdmin();

  const parsed = couponInputSchema.safeParse({
    code: formData.get("code") ?? "",
    percentOff: formData.get("percentOff") ?? "",
    minSubtotal: formData.get("minSubtotal") ?? "",
    maxUses: formData.get("maxUses") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await adminCreateCoupon(parsed.data);
    await logAction({
      action: "coupon.create",
      entity: "coupon",
      summary: `Criou o cupom ${parsed.data.code} (${parsed.data.percentOff}% off)`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar o cupom" };
  }
  revalidatePath("/admin/cupons");
  return { ok: true };
}

async function couponCode(id: string) {
  return (await listCoupons()).find((c) => c.id === id)?.code ?? id;
}

export async function toggleCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  try {
    await adminSetCouponActive(id, active);
    await logAction({
      action: "coupon.active",
      entity: "coupon",
      entityId: id,
      summary: `${active ? "Ativou" : "Desativou"} o cupom ${await couponCode(id)}`,
    });
  } catch (err) {
    console.error("toggleCoupon:", (err as Error).message);
  }
  revalidatePath("/admin/cupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const code = await couponCode(id);
  try {
    await adminDeleteCoupon(id);
    await logAction({
      action: "coupon.delete",
      entity: "coupon",
      entityId: id,
      summary: `Apagou o cupom ${code}`,
    });
  } catch (err) {
    console.error("deleteCoupon:", (err as Error).message);
  }
  revalidatePath("/admin/cupons");
}
