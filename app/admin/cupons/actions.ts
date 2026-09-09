"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { couponInputSchema } from "@/lib/coupon-schema";
import {
  adminCreateCoupon,
  adminDeleteCoupon,
  adminSetCouponActive,
} from "@/lib/data/coupons";

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
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar o cupom" };
  }
  revalidatePath("/admin/cupons");
  return { ok: true };
}

export async function toggleCouponAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminSetCouponActive(
      String(formData.get("id")),
      formData.get("active") === "true",
    );
  } catch (err) {
    console.error("toggleCoupon:", (err as Error).message);
  }
  revalidatePath("/admin/cupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminDeleteCoupon(String(formData.get("id")));
  } catch (err) {
    console.error("deleteCoupon:", (err as Error).message);
  }
  revalidatePath("/admin/cupons");
}
