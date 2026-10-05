"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminCreateProduct, adminListProducts, adminSetProductCost, adminSetVariantStock } from "@/lib/data/admin";
import { logAction } from "@/lib/data/audit";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(max).nullable());

const itemSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(2, "Dê um nome ao produto").max(120),
    categoryId: z.string().min(1, "Escolha a categoria"),
    size: optStr(30),
    color: optStr(40),
    quantity: z.number().int().min(0).max(9999),
    cost: z.number().min(0).max(100000),
    price: z.number().positive("Informe o preço de venda").max(100000),
  }),
  z.object({
    mode: z.literal("restock"),
    productId: z.string().min(1, "Escolha o produto"),
    variantId: z.string().min(1, "Escolha a variação"),
    quantity: z.number().int().min(1).max(9999),
    cost: z.number().min(0).max(100000).nullable(),
  }),
]);

export type ImportItem = z.input<typeof itemSchema>;
export type ImportResult = { index: number; ok: boolean; label: string; productId?: string; error?: string };

/**
 * Cadastra os itens revisados de uma nota: produto novo (criado como RASCUNHO, sem aparecer na loja
 * até ter foto e ser ativado) ou soma quantidade ao estoque de um produto que já existe.
 * Cada item é independente: se um falhar, os outros seguem.
 */
export async function importInvoiceItemsAction(
  raw: ImportItem[],
): Promise<{ ok: true; results: ImportResult[] } | { ok: false; error: string }> {
  await requireAdmin();
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Nenhum item selecionado." };
  if (raw.length > 80) return { ok: false, error: "Itens demais de uma vez (máx. 80)." };

  const products = await adminListProducts();
  const results: ImportResult[] = [];
  let created = 0;
  let restocked = 0;

  for (let index = 0; index < raw.length; index++) {
    const parsed = itemSchema.safeParse(raw[index]);
    const guess = (raw[index] as { name?: string })?.name ?? "item";
    if (!parsed.success) {
      results.push({ index, ok: false, label: guess, error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      continue;
    }
    const it = parsed.data;
    try {
      if (it.mode === "new") {
        const id = await adminCreateProduct(
          {
            name: it.name,
            description: null,
            categoryId: it.categoryId,
            brand: null,
            gender: null,
            ageMinMonths: null,
            ageMaxMonths: null,
            compareAtPrice: null,
            composition: null,
            material: null,
            dimensions: null,
            fitNotes: null,
            careNotes: null,
            active: false, // rascunho: só vai pra loja depois da foto e da sua revisão
            splitByColor: false,
          },
          [{ size: it.size, color: it.color, colorHex: null, price: it.price, stock: it.quantity, weightGrams: 300 }],
          it.cost > 0 ? it.cost : null,
        );
        created++;
        results.push({ index, ok: true, label: it.name, productId: id });
      } else {
        const product = products.find((p) => p.id === it.productId);
        const variant = product?.variants.find((v) => v.id === it.variantId);
        if (!product || !variant) throw new Error("Produto ou variação não encontrados");
        await adminSetVariantStock(variant.id, variant.stock + it.quantity, "Compra (cadastro por nota)");
        if (it.cost != null && it.cost > 0) await adminSetProductCost(product.id, it.cost);
        restocked++;
        results.push({ index, ok: true, label: product.name, productId: product.id });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar";
      results.push({
        index,
        ok: false,
        label: it.mode === "new" ? it.name : guess,
        error: /duplicate key|already exists/i.test(msg)
          ? "Já existe um produto com esse nome — use “Somar ao estoque”."
          : msg,
      });
    }
  }

  if (created + restocked > 0) {
    await logAction({
      action: "product.import",
      entity: "product",
      summary: `Cadastro por nota: ${created} produto${created === 1 ? "" : "s"} novo${created === 1 ? "" : "s"} (rascunho) e ${restocked} reposição${restocked === 1 ? "" : "ões"} de estoque`,
    });
    revalidatePath("/admin/produtos");
    revalidatePath("/admin/estoque");
    revalidatePath("/admin/precificacao");
    revalidatePath("/");
  }
  return { ok: true, results };
}
