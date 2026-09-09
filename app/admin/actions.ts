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
  adminGetProduct,
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
import { reconcileOrderPayment } from "@/lib/mp-reconcile";
import { logAction } from "@/lib/data/audit";
import { ORDER_STATUS } from "@/lib/order-status";
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
  splitByColor: z.boolean(),
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
    splitByColor: formData.get("splitByColor") === "on",
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
      await logAction({
        action: "product.update",
        entity: "product",
        entityId: id,
        summary: `Editou o produto "${product.name}"`,
      });
    } else {
      newId = await adminCreateProduct(product, variants);
      await logAction({
        action: "product.create",
        entity: "product",
        entityId: newId,
        summary: `Criou o produto "${product.name}"`,
      });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao salvar" };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/");
  // ao criar, vai direto pra tela do produto (onde ficam as fotos)
  redirect(newId ? `/admin/produtos/${newId}?criado=1` : "/admin/produtos");
}

export async function deleteProductAction(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const before = await adminGetProduct(id);
  try {
    await adminDeleteProduct(id);
  } catch (err) {
    console.error("deleteProduct:", (err as Error).message);
    return { error: "Não foi possível apagar o produto." };
  }
  await logAction({
    action: "product.delete",
    entity: "product",
    entityId: id,
    summary: `Apagou o produto "${before?.name ?? id}"`,
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function toggleProductActiveAction(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireAdmin();
  const before = await adminGetProduct(id);
  try {
    await adminSetProductActive(id, active);
  } catch (err) {
    console.error("toggleProductActive:", (err as Error).message);
    return { error: "Não foi possível mudar o status." };
  }
  await logAction({
    action: "product.active",
    entity: "product",
    entityId: id,
    summary: `${active ? "Ativou" : "Desativou"} o produto "${before?.name ?? id}"`,
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  return {};
}

async function productName(id: string) {
  return (await adminGetProduct(id))?.name ?? id;
}

export async function addImageUrlAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId"));
  const url = String(formData.get("url") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  try {
    if (url) {
      await adminAddImageUrl(productId, url, color);
      await logAction({
        action: "product.image.add",
        entity: "product",
        entityId: productId,
        summary: `Adicionou uma foto ao produto "${await productName(productId)}"`,
      });
    }
  } catch (err) {
    console.error("addImageUrl:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
}

export async function reorderImagesAction(productId: string, ids: string[]) {
  await requireAdmin();
  try {
    await adminReorderImages(productId, ids);
    await logAction({
      action: "product.image.reorder",
      entity: "product",
      entityId: productId,
      summary: `Reordenou as fotos do produto "${await productName(productId)}"`,
    });
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
    await logAction({
      action: "product.video",
      entity: "product",
      entityId: productId,
      summary: `${value ? "Definiu" : "Removeu"} o vídeo do produto "${await productName(productId)}"`,
    });
  } catch (err) {
    console.error("setProductVideo:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
}

export async function setImageColorAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId"));
  const color = String(formData.get("color") ?? "").trim() || null;
  try {
    await adminSetImageColor(String(formData.get("imageId")), color);
    await logAction({
      action: "product.image.color",
      entity: "product",
      entityId: productId,
      summary: `Atribuiu uma foto à cor ${color ?? "(todas)"} — "${await productName(productId)}"`,
    });
  } catch (err) {
    console.error("setImageColor:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
}

export async function deleteImageAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId"));
  try {
    await adminDeleteImage(String(formData.get("imageId")));
    await logAction({
      action: "product.image.delete",
      entity: "product",
      entityId: productId,
      summary: `Removeu uma foto do produto "${await productName(productId)}"`,
    });
  } catch (err) {
    console.error("deleteImage:", (err as Error).message);
  }
  revalidatePath(`/admin/produtos/${productId}`);
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
    await logAction({
      action: "category.create",
      entity: "category",
      summary: `Criou a categoria "${name}" (${kind})`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar" };
  }
  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  try {
    await adminDeleteCategory(id);
    await logAction({
      action: "category.delete",
      entity: "category",
      entityId: id,
      summary: `Apagou uma categoria`,
    });
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

  if (current && current.status !== status) {
    await logAction({
      action: "order.status",
      entity: "order",
      entityId: id,
      summary: `Mudou o pedido ${current.number} para "${ORDER_STATUS[status].label}"${
        trackingCode ? ` (rastreio ${trackingCode})` : ""
      }`,
      meta: { from: current.status, to: status },
    });
  } else if (trackingCode) {
    await logAction({
      action: "order.tracking",
      entity: "order",
      entityId: id,
      summary: `Adicionou o rastreio ${trackingCode} ao pedido ${current?.number ?? id}`,
    });
  }

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

export async function recheckPaymentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const order = await getOrderById(id);
  await reconcileOrderPayment(id);
  await logAction({
    action: "order.recheck",
    entity: "order",
    entityId: id,
    summary: `Rechecou o pagamento do pedido ${order?.number ?? id} no Mercado Pago`,
  });
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
}

export async function deleteOrderAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  await requireMasterAdmin();
  const before = await getOrderById(id);
  try {
    await adminDeleteOrder(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao apagar" };
  }
  await logAction({
    action: "order.delete",
    entity: "order",
    entityId: id,
    summary: `Apagou o pedido ${before?.number ?? id}${
      before ? ` (${before.customer_name ?? before.email})` : ""
    }`,
  });
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  // a navegação é feita no cliente (a página do pedido deixa de existir)
  return { ok: true };
}
