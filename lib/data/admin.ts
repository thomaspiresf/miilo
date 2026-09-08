import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { mapProduct, listProducts, getCategories } from "@/lib/data/catalog";
import { slugify } from "@/lib/utils";
import type {
  Category,
  Product,
  StockMovement,
  VariantStockRow,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Se o Supabase está ligado para leitura mas falta a chave service_role,
 * uma escrita "de mentira" no mock só confundiria (a loja não veria).
 * Melhor falhar com uma mensagem clara.
 */
function assertPersistable() {
  if (hasSupabase() && !hasSupabaseAdmin()) {
    throw new Error(
      "Configure SUPABASE_SERVICE_ROLE_KEY (chave sb_secret_…) no .env.local para salvar no banco.",
    );
  }
}

export type ProductInput = {
  name: string;
  description: string | null;
  categoryId: string;
  brand: string | null;
  gender: Product["gender"];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  compareAtPrice: number | null;
  composition: string | null;
  fitNotes: string | null;
  careNotes: string | null;
  active: boolean;
};

export type VariantInput = {
  size: string | null;
  color: string | null;
  colorHex: string | null;
  price: number;
  stock: number;
  weightGrams: number;
};

const ADMIN_PRODUCT_SELECT = `
  id, slug, name, description, brand, gender, age_min_months, age_max_months, active, base_price,
  compare_at_price, composition, fit_notes, care_notes, rating_avg, rating_count, max_installments,
  category:categories(id, slug, name, kind),
  images:product_images(id, storage_path, alt, sort),
  variants:product_variants(id, sku, size, color, color_hex, price, stock, weight_grams, active)
`;

// --------------------------------------------------------------------------
//  Listagens (incluem inativos — visão do admin)
// --------------------------------------------------------------------------
export async function adminListProducts(): Promise<Product[]> {
  if (hasSupabaseAdmin()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("products")
      .select(ADMIN_PRODUCT_SELECT)
      .order("created_at", { ascending: false });
    return (data ?? []).map((row: any) => mapProduct(row));
  }
  // Supabase só de leitura (sem a chave secret): mostra o catálogo real (ativos)
  if (hasSupabase()) return listProducts({});
  return mockDB().products;
}

export async function adminGetProduct(id: string): Promise<Product | null> {
  if (hasSupabaseAdmin() || !hasSupabase()) {
    const all = await adminListProducts();
    return all.find((p) => p.id === id) ?? null;
  }
  // leitura via anon: busca por id não é exposta, então varremos a lista
  const all = await listProducts({});
  return all.find((p) => p.id === id) ?? null;
}

export async function adminListCategories(): Promise<Category[]> {
  if (hasSupabaseAdmin()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("categories")
      .select("id, slug, name, kind, sort")
      .order("sort");
    return (data ?? []) as Category[];
  }
  if (hasSupabase()) return getCategories();
  return mockDB().categories;
}

// --------------------------------------------------------------------------
//  Produtos — criar / editar
// --------------------------------------------------------------------------
function productRow(input: ProductInput, basePrice: number) {
  return {
    name: input.name,
    description: input.description,
    category_id: input.categoryId,
    brand: input.brand,
    gender: input.gender,
    age_min_months: input.ageMinMonths,
    age_max_months: input.ageMaxMonths,
    base_price: basePrice,
    compare_at_price: input.compareAtPrice,
    composition: input.composition,
    fit_notes: input.fitNotes,
    care_notes: input.careNotes,
    active: input.active,
  };
}

function variantRow(v: VariantInput) {
  return {
    size: v.size,
    color: v.color,
    color_hex: v.colorHex,
    price: v.price,
    stock: v.stock,
    weight_grams: v.weightGrams,
  };
}

function buildMockProduct(
  id: string,
  slug: string,
  input: ProductInput,
  variants: (VariantInput & { id?: string })[],
): Product {
  const db = mockDB();
  const category = db.categories.find((c) => c.id === input.categoryId)!;
  const basePrice = Math.min(...variants.map((v) => v.price));
  const compareAt =
    input.compareAtPrice && input.compareAtPrice > basePrice ? input.compareAtPrice : null;
  return {
    id,
    slug,
    name: input.name,
    description: input.description,
    brand: input.brand,
    gender: input.gender,
    age_min_months: input.ageMinMonths,
    age_max_months: input.ageMaxMonths,
    active: input.active,
    base_price: basePrice,
    compare_at_price: compareAt,
    composition: input.composition,
    fit_notes: input.fitNotes,
    care_notes: input.careNotes,
    rating_avg: null,
    rating_count: 0,
    max_installments: 3,
    category: { id: category.id, slug: category.slug, name: category.name, kind: category.kind },
    images: [],
    variants: variants.map((v, i) => ({
      id: v.id ?? `${id}-v${i}-${Date.now()}`,
      sku: null,
      size: v.size,
      color: v.color,
      color_hex: v.colorHex,
      price: v.price,
      stock: v.stock,
      weight_grams: v.weightGrams,
      active: true,
    })),
    price_from: basePrice,
    compare_at_from: compareAt,
    in_stock: variants.some((v) => v.stock > 0),
  };
}

export async function adminCreateProduct(
  input: ProductInput,
  variants: VariantInput[],
): Promise<string> {
  assertPersistable();
  const slug = slugify(input.name) || `produto-${Date.now()}`;
  const basePrice = Math.min(...variants.map((v) => v.price));

  if (!hasSupabaseAdmin()) {
    const id = `p-${Date.now()}`;
    const product = buildMockProduct(id, slug, input, variants);
    product.images = [];
    mockDB().products.unshift(product);
    return id;
  }

  const admin = createAdminClient();
  const { data: product, error } = await admin
    .from("products")
    .insert({ slug, ...productRow(input, basePrice) })
    .select("id")
    .single();
  if (error) throw error;

  await admin
    .from("product_variants")
    .insert(variants.map((v) => ({ product_id: product.id, ...variantRow(v) })));
  return product.id;
}

export async function adminUpdateProduct(
  id: string,
  input: ProductInput,
  variants: (VariantInput & { id?: string })[],
): Promise<void> {
  assertPersistable();
  const basePrice = Math.min(...variants.map((v) => v.price));

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const rebuilt = buildMockProduct(id, p.slug, input, variants);
    rebuilt.images = p.images;
    rebuilt.rating_avg = p.rating_avg;
    rebuilt.rating_count = p.rating_count;
    Object.assign(p, rebuilt);
    return;
  }

  const admin = createAdminClient();
  await admin.from("products").update(productRow(input, basePrice)).eq("id", id);

  const keepIds = variants.filter((v) => v.id).map((v) => v.id);
  await admin
    .from("product_variants")
    .delete()
    .eq("product_id", id)
    .not("id", "in", `(${keepIds.length ? keepIds.join(",") : "'00000000-0000-0000-0000-000000000000'"})`);

  for (const v of variants) {
    if (v.id) {
      await admin.from("product_variants").update(variantRow(v)).eq("id", v.id);
    } else {
      await admin.from("product_variants").insert({ product_id: id, ...variantRow(v) });
    }
  }
}

export async function adminSetProductActive(id: string, active: boolean): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === id);
    if (p) p.active = active;
    return;
  }
  const admin = createAdminClient();
  await admin.from("products").update({ active }).eq("id", id);
}

export async function adminAddImageUrl(productId: string, storagePathOrUrl: string): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === productId);
    if (p)
      p.images.push({
        id: `img-${Date.now()}`,
        url: storagePathOrUrl,
        alt: null,
        sort: p.images.length,
      });
    return;
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  await admin
    .from("product_images")
    .insert({ product_id: productId, storage_path: storagePathOrUrl, sort: count ?? 0 });
}

export async function adminDeleteImage(imageId: string): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    for (const p of mockDB().products) p.images = p.images.filter((im) => im.id !== imageId);
    return;
  }
  const admin = createAdminClient();
  // apaga também o arquivo do Storage se for um path do bucket
  const { data: row } = await admin
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();
  const path = row?.storage_path as string | undefined;
  if (path && !path.startsWith("http")) {
    await admin.storage.from("product-images").remove([path]);
  }
  await admin.from("product_images").delete().eq("id", imageId);
}

const BUCKET = "product-images";
const MAX_BYTES = 6 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Faz upload de um arquivo de imagem para o Storage e registra em product_images. */
export async function adminUploadImage(
  productId: string,
  file: File,
): Promise<{ url: string }> {
  assertPersistable();
  if (!OK_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Imagem muito grande (máx. 6 MB).");
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;

  if (!hasSupabaseAdmin()) {
    // mock: guarda como data URL só para visualizar
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    await adminAddImageUrl(productId, dataUrl);
    return { url: dataUrl };
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  await adminAddImageUrl(productId, path);
  return {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
  };
}

// --------------------------------------------------------------------------
//  Categorias
// --------------------------------------------------------------------------
export async function adminCreateCategory(name: string, kind: "roupas" | "brinquedos"): Promise<void> {
  assertPersistable();
  const slug = slugify(name);
  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    db.categories.push({ id: `cat-${Date.now()}`, slug, name, kind, sort: db.categories.length + 1 });
    return;
  }
  const admin = createAdminClient();
  await admin.from("categories").insert({ slug, name, kind, sort: 99 });
}

// --------------------------------------------------------------------------
//  Estoque
// --------------------------------------------------------------------------
function variantLabel(size: string | null, color: string | null) {
  return [size, color].filter(Boolean).join(" · ") || "Único";
}

/** Lista achatada de todas as variações, para a tela de estoque. */
export async function adminListVariants(): Promise<VariantStockRow[]> {
  const products = await adminListProducts();
  const rows: VariantStockRow[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      rows.push({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        productSlug: p.slug,
        productActive: p.active,
        label: variantLabel(v.size, v.color),
        sku: v.sku,
        price: v.price,
        stock: v.stock,
      });
    }
  }
  return rows.sort((a, b) =>
    a.productName === b.productName
      ? a.label.localeCompare(b.label)
      : a.productName.localeCompare(b.productName),
  );
}

/** Define o estoque absoluto de uma variação e registra a movimentação. */
export async function adminSetVariantStock(
  variantId: string,
  newStock: number,
  note?: string | null,
): Promise<number> {
  assertPersistable();
  const stock = Math.max(0, Math.round(newStock));

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    for (const p of db.products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) {
        const delta = stock - v.stock;
        v.stock = stock;
        p.in_stock = p.variants.some((x) => x.stock > 0);
        db.movements.unshift({
          id: crypto.randomUUID(),
          variant_id: variantId,
          delta,
          reason: "adjustment",
          note: note ?? null,
          order_id: null,
          balance_after: stock,
          created_at: new Date().toISOString(),
          product_name: p.name,
          variant_label: v.size || v.color ? variantLabel(v.size, v.color) : null,
        });
      }
    }
    return stock;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("adjust_variant_stock", {
    p_variant_id: variantId,
    p_new_stock: stock,
    p_note: note ?? null,
  });
  if (error) {
    // fallback se a migração de estoque ainda não foi aplicada
    const { error: upErr } = await admin
      .from("product_variants")
      .update({ stock })
      .eq("id", variantId);
    if (upErr) throw upErr;
    return stock;
  }
  return Number(data);
}

/** Últimas movimentações de estoque, com nome do produto. */
export async function adminRecentStockMovements(limit = 30): Promise<StockMovement[]> {
  if (!hasSupabaseAdmin()) {
    return mockDB().movements.slice(0, limit);
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stock_movements")
    .select(
      "id, variant_id, delta, reason, note, order_id, balance_after, created_at, variant:product_variants(size, color, product:products(name))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return []; // migração de estoque ainda não aplicada

  return (data ?? []).map((m: any) => ({
    id: m.id,
    variant_id: m.variant_id,
    delta: m.delta,
    reason: m.reason,
    note: m.note ?? null,
    order_id: m.order_id ?? null,
    balance_after: m.balance_after ?? null,
    created_at: m.created_at,
    product_name: m.variant?.product?.name ?? undefined,
    variant_label: m.variant
      ? variantLabel(m.variant.size ?? null, m.variant.color ?? null)
      : null,
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
