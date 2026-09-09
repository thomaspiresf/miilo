"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireMasterAdmin } from "@/lib/auth";
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminSetProductActive,
  adminDeleteProduct,
  adminAddImageUrl,
  adminSetImageColor,
  adminReorderImages,
  adminDeleteImage,
  adminCreateCategory,
  adminDeleteCategory,
  adminSetProductVideo,
} from "@/lib/data/admin";
import {
  adminDeleteOrder,
  approveOrder,
  getOrderById,
  setOrderStatus,
} from "@/lib/data/orders";
import { parseMoney } from "@/lib/format";
import type { CategoryKind, OrderStatus } from "@/lib/types";

const variantSchema = z.object({
  id: z.string().optional(),
  size: z.string().trim().nullable().default(null),
  color: z.string().trim().nullable().default(null),
  colorHex: z.string().trim().nullable().default(null),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  weightGrams: z.number().int().positive(),
});

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable(),
  categoryId: z.string().min(1),
  brand: z.string().nullable(),
  gender: z.enum(["menino", "menina", "unissex"]).nullable(),
  ageMinMonths: z.number().int().nonnegative().nullable(),
  ageMaxMonths: z.number().int().nonnegative().nullable(),
  compareAtPrice: z.number().nonnegative().nullable(),
  composition: z.string().nullable(),
  material: z.string().nullable(),
  dimensions: z.string().nullable(),
  fitNotes: z.string().nullable(),
  careNotes: z.string().nullable(),
  active: z.boolean(),
  variants: z.array(variantSchema).min(1),
});

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function saveProductAction(_prev: unknown, formData: FormData) {
  await requireAdmin();

  const str = (k: string) => (String(formData.get(k) ?? "").trim() || null) as string | null;
  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    description: str("description"),
    categoryId: String(formData.get("categoryId") ?? ""),
    brand: str("brand"),
    gender: (formData.get("gender") || null) as "menino" | "menina" | "unissex" | null,
    ageMinMonths: num(formData.get("ageMinMonths")),
    ageMaxMonths: num(formData.get("ageMaxMonths")),
    compareAtPrice: parseMoney(String(formData.get("compareAtPrice") ?? "")),
    composition: str("composition"),
    material: str("material"),
    dimensions: str("dimensions"),
    fitNotes: str("fitNotes"),
    careNotes: str("careNotes"),
    active: formData.get("active") === "on",
    variants: JSON.parse(String(formData.get("variants") ?? "[]")),
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const id = String(formData.get("id") ?? "");
  const { variants, ...product } = parsed.data;

  let newId: string | null = null;
  try {
    if (id && id !== "novo") {
      await adminUpdateProduct(id, product, variants);
    } else {
      newId = await adminCreateProduct(product, variants);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao salvar" };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/");
  // ao criar, vai direto pra tela do produto (onde ficam as fotos)
  redirect(newId ? `/admin/produtos/${newId}?criado=1` : "/admin/produtos");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminDeleteProduct(String(formData.get("id")));
  } catch (err) {
    console.error("deleteProduct:", (err as Error).message);
  }
  revalidatePath("/admin/produtos");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin/produtos");
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminSetProductActive(
      String(formData.get("id")),
      formData.get("active") === "true",
    );
  } catch (err) {
    console.error("toggleProductActive:", (err as Error).message);
  }
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function addImageUrlAction(formData: FormData) {
  await requireAdmin();
  const url = String(formData.get("url") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  try {
    if (url) await adminAddImageUrl(String(formData.get("productId")), url, color);
  } catch (err) {
    console.error("addImageUrl:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${formData.get("productId")}`);
}

export async function reorderImagesAction(productId: string, ids: string[]) {
  await requireAdmin();
  try {
    await adminReorderImages(productId, ids);
  } catch (err) {
    console.error("reorderImages:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
}

export async function setProductVideoAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId"));
  const value = String(formData.get("value") ?? "").trim() || null;
  try {
    await adminSetProductVideo(productId, value);
  } catch (err) {
    console.error("setProductVideo:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
}

export async function setImageColorAction(formData: FormData) {
  await requireAdmin();
  const color = String(formData.get("color") ?? "").trim() || null;
  try {
    await adminSetImageColor(String(formData.get("imageId")), color);
  } catch (err) {
    console.error("setImageColor:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${formData.get("productId")}`);
}

export async function deleteImageAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminDeleteImage(String(formData.get("imageId")));
  } catch (err) {
    console.error("deleteImage:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${formData.get("productId")}`);
}

export async function createCategoryAction(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "");
  const kind: CategoryKind =
    rawKind === "brinquedos" || rawKind === "livros" ? rawKind : "roupas";
  if (name.length < 2) return { error: "Nome muito curto" };
  try {
    await adminCreateCategory(name, kind);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar" };
  }
  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  try {
    await adminDeleteCategory(String(formData.get("id")));
  } catch (err) {
    console.error("deleteCategory:", (err as Error).message);
  }
  revalidatePath("/admin/categorias");
  revalidatePath("/");
}

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "shipped",
  "delivered",
];

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const raw = String(formData.get("status"));
  const status = (ORDER_STATUSES.includes(raw as OrderStatus) ? raw : "pending") as OrderStatus;
  const trackingCode = String(formData.get("trackingCode") ?? "").trim() || null;

  const current = await getOrderById(id);
  // marcar como "pago" manualmente baixa o estoque + envia confirmação (como o webhook)
  if (status === "paid" && current && current.status !== "paid") {
    await approveOrder(id, { mpStatus: "manual", method: current.payment_method ?? "manual" });
    if (trackingCode) await setOrderStatus(id, "paid", { trackingCode });
  } else {
    await setOrderStatus(id, status, { trackingCode });
  }

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

export async function deleteOrderAction(formData: FormData) {
  await requireMasterAdmin();
  try {
    await adminDeleteOrder(String(formData.get("id")));
  } catch (err) {
    console.error("deleteOrder:", (err as Error).message);
  }
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  redirect("/admin/pedidos");
}
