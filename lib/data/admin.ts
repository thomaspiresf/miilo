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
  material: string | null;
  dimensions: string | null;
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
  *,
  category:categories(id, slug, name, kind),
  images:product_images(*),
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
    material: input.material,
    dimensions: input.dimensions,
    fit_notes: input.fitNotes,
    care_notes: input.careNotes,
    active: input.active,
  };
}

const MISSING_COLUMN = /column .* does not exist|schema cache|could not find/i;

/** Remove colunas de migração ainda não aplicada (material/dimensions). */
function stripNewColumns(row: Record<string, unknown>) {
  const clone = { ...row };
  delete clone.material;
  delete clone.dimensions;
  return clone;
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
    material: input.material,
    dimensions: input.dimensions,
    fit_notes: input.fitNotes,
    care_notes: input.careNotes,
    rating_avg: null,
    rating_count: 0,
    max_installments: 3,
    video_url: null,
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
  const newRow = { slug, ...productRow(input, basePrice) };
  let ins = await admin.from("products").insert(newRow).select("id").single();
  if (ins.error && MISSING_COLUMN.test(ins.error.message)) {
    ins = await admin.from("products").insert(stripNewColumns(newRow)).select("id").single();
  }
  if (ins.error) throw ins.error;
  const product = ins.data;

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
    rebuilt.video_url = p.video_url;
    Object.assign(p, rebuilt);
    return;
  }

  const admin = createAdminClient();
  const patch = productRow(input, basePrice);
  const upd = await admin.from("products").update(patch).eq("id", id);
  if (upd.error && MISSING_COLUMN.test(upd.error.message)) {
    await admin.from("products").update(stripNewColumns(patch)).eq("id", id);
  }

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

/**
 * Apaga o produto de vez. Variações, imagens e movimentações de estoque somem
 * junto (cascade). O histórico de pedidos é preservado — cada item de pedido
 * guarda nome/preço/qtd e só perde o vínculo com a variação (set null).
 */
export async function adminDeleteProduct(id: string): Promise<void> {
  assertPersistable();

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    db.products = db.products.filter((p) => p.id !== id);
    return;
  }

  const admin = createAdminClient();
  // remove os arquivos de imagem do Storage (o cascade só apaga as linhas)
  const { data: imgs } = await admin
    .from("product_images")
    .select("storage_path")
    .eq("product_id", id);
  const paths = (imgs ?? [])
    .map((r) => r.storage_path as string)
    .filter((p) => p && !p.startsWith("http") && !p.startsWith("data:"));
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function adminAddImageUrl(
  productId: string,
  storagePathOrUrl: string,
  color: string | null = null,
): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === productId);
    if (p)
      p.images.push({
        id: `img-${Date.now()}`,
        url: storagePathOrUrl,
        alt: null,
        sort: p.images.length,
        color: color || null,
      });
    return;
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const row = { product_id: productId, storage_path: storagePathOrUrl, sort: count ?? 0 };
  let ins = await admin.from("product_images").insert({ ...row, color: color || null });
  if (ins.error && MISSING_COLUMN.test(ins.error.message)) {
    ins = await admin.from("product_images").insert(row);
  }
  if (ins.error) throw ins.error;
}

/** Reordena as fotos do produto conforme a lista de ids. */
export async function adminReorderImages(
  productId: string,
  ids: string[],
): Promise<void> {
  assertPersistable();

  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === productId);
    if (!p) return;
    p.images = [...p.images]
      .sort((a, b) => {
        const ia = ids.indexOf(a.id);
        const ib = ids.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
      .map((im, i) => ({ ...im, sort: i }));
    return;
  }

  const admin = createAdminClient();
  await Promise.all(
    ids.map((id, i) =>
      admin.from("product_images").update({ sort: i }).eq("id", id).eq("product_id", productId),
    ),
  );
}

/** Define (ou limpa) a cor de uma imagem. */
export async function adminSetImageColor(
  imageId: string,
  color: string | null,
): Promise<void> {
  assertPersistable();
  if (!hasSupabaseAdmin()) {
    for (const p of mockDB().products) {
      const im = p.images.find((x) => x.id === imageId);
      if (im) im.color = color || null;
    }
    return;
  }
  const admin = createAdminClient();
  const upd = await admin
    .from("product_images")
    .update({ color: color || null })
    .eq("id", imageId);
  if (upd.error && !MISSING_COLUMN.test(upd.error.message)) throw upd.error;
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
  color: string | null = null,
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
    await adminAddImageUrl(productId, dataUrl, color);
    return { url: dataUrl };
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  await adminAddImageUrl(productId, path, color);
  return {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
  };
}

const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_OK_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/** Grava o vídeo do produto (path do bucket, link YouTube/Vimeo, ou null pra remover). */
export async function adminSetProductVideo(
  productId: string,
  value: string | null,
): Promise<void> {
  assertPersistable();
  const v = value?.trim() || null;

  if (!hasSupabaseAdmin()) {
    const p = mockDB().products.find((x) => x.id === productId);
    if (p) p.video_url = v;
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.from("products").update({ video_url: v }).eq("id", productId);
  if (error && !MISSING_COLUMN.test(error.message)) throw error;
}

/** Sobe um arquivo de vídeo pro Storage e liga ao produto. */
export async function adminUploadVideo(
  productId: string,
  file: File,
): Promise<{ url: string }> {
  assertPersistable();
  if (!VIDEO_OK_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use MP4, WebM ou MOV.");
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error("Vídeo muito grande (máx. 50 MB). Deixe o clipe curto ou use um link do YouTube/Vimeo.");
  }

  const ext = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1];
  const path = `${productId}/video-${crypto.randomUUID()}.${ext}`;

  if (!hasSupabaseAdmin()) {
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    await adminSetProductVideo(productId, dataUrl);
    return { url: dataUrl };
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  await adminSetProductVideo(productId, path);
  return {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
  };
}

// --------------------------------------------------------------------------
//  Categorias
// --------------------------------------------------------------------------
// slugs reservados para as rotas de nível 1 (kind) e "todos"
const RESERVED_SLUGS = ["tudo", "roupas", "brinquedos"];

/** Gera um slug único que não colide com os reservados nem com categorias existentes. */
function uniqueCategorySlug(name: string, taken: Set<string>) {
  const base = slugify(name) || "categoria";
  let slug = RESERVED_SLUGS.includes(base) ? `${base}-geral` : base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function adminCreateCategory(name: string, kind: "roupas" | "brinquedos"): Promise<void> {
  assertPersistable();

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    const slug = uniqueCategorySlug(name, new Set(db.categories.map((c) => c.slug)));
    db.categories.push({ id: `cat-${Date.now()}`, slug, name, kind, sort: db.categories.length + 1 });
    return;
  }
  const admin = createAdminClient();
  const { data: existing } = await admin.from("categories").select("slug");
  const slug = uniqueCategorySlug(name, new Set((existing ?? []).map((c) => c.slug)));
  const { error } = await admin.from("categories").insert({ slug, name, kind, sort: 99 });
  if (error) throw error;
}

export async function adminDeleteCategory(id: string): Promise<void> {
  assertPersistable();

  if (!hasSupabaseAdmin()) {
    const db = mockDB();
    if (db.products.some((p) => p.category.id === id)) {
      throw new Error("Mova os produtos para outra categoria antes de excluir.");
    }
    db.categories = db.categories.filter((c) => c.id !== id);
    return;
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    throw new Error("Mova os produtos para outra categoria antes de excluir.");
  }
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) throw error;
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
