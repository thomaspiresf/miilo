import "server-only";
import { createClient } from "@/lib/supabase/server";
import { env, hasSupabase } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import type { Category, CatalogFilters, Product } from "@/lib/types";

/** Converte um storage_path (path no bucket OU URL absoluta) em URL pública. */
export function imageUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${env.supabase.url}/storage/v1/object/public/product-images/${path}`;
}

const PRODUCT_SELECT = `
  id, slug, name, description, brand, gender, age_min_months, age_max_months, active, base_price,
  compare_at_price, composition, fit_notes, care_notes, rating_avg, rating_count, max_installments,
  category:categories!inner(id, slug, name, kind),
  images:product_images(id, storage_path, alt, sort),
  variants:product_variants(id, sku, size, color, color_hex, price, stock, weight_grams, active)
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapProduct(row: any): Product {
  const images = (row.images ?? [])
    .map((im: any) => ({
      id: im.id,
      url: imageUrl(im.storage_path),
      alt: im.alt ?? null,
      sort: im.sort ?? 0,
    }))
    .sort((a: any, b: any) => a.sort - b.sort);

  const variants = (row.variants ?? [])
    .filter((v: any) => v.active !== false)
    .map((v: any) => ({
      id: v.id,
      sku: v.sku ?? null,
      size: v.size ?? null,
      color: v.color ?? null,
      color_hex: v.color_hex ?? null,
      price: Number(v.price),
      stock: Number(v.stock ?? 0),
      weight_grams: Number(v.weight_grams ?? 300),
      active: v.active ?? true,
    }));

  const prices = variants.length
    ? variants.map((v: any) => v.price)
    : [Number(row.base_price)];
  const priceFrom = Math.min(...prices);
  const compareAt =
    row.compare_at_price != null && Number(row.compare_at_price) > priceFrom
      ? Number(row.compare_at_price)
      : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    brand: row.brand ?? null,
    gender: row.gender ?? null,
    age_min_months: row.age_min_months ?? null,
    age_max_months: row.age_max_months ?? null,
    active: row.active ?? true,
    base_price: Number(row.base_price),
    compare_at_price: compareAt,
    composition: row.composition ?? null,
    fit_notes: row.fit_notes ?? null,
    care_notes: row.care_notes ?? null,
    rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
    rating_count: Number(row.rating_count ?? 0),
    max_installments: Number(row.max_installments ?? 3),
    category: row.category,
    images,
    variants,
    price_from: priceFrom,
    compare_at_from: compareAt,
    in_stock: variants.some((v: any) => v.stock > 0),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let schemaWarned = false;

/**
 * Roda a consulta no Supabase; se ele não estiver configurado OU a consulta
 * falhar (ex.: schema ainda não aplicado), cai no catálogo de exemplo.
 */
async function withFallback<T>(
  supabaseFn: () => Promise<T>,
  mockFn: () => T,
): Promise<T> {
  if (!hasSupabase()) return mockFn();
  try {
    return await supabaseFn();
  } catch (err) {
    if (!schemaWarned) {
      schemaWarned = true;
      console.warn(
        `[miilo] Supabase configurado mas a consulta falhou (${
          (err as Error).message
        }). Usando catálogo de exemplo — rode supabase/schema.sql no SQL Editor.`,
      );
    }
    return mockFn();
  }
}

// --------------------------------------------------------------------------
//  Categorias
// --------------------------------------------------------------------------
export async function getCategories(): Promise<Category[]> {
  return withFallback(
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, kind, sort")
        .order("sort");
      if (error) throw error;
      if (!data?.length) throw new Error("sem categorias");
      return data as Category[];
    },
    () => [...mockDB().categories].sort((a, b) => a.sort - b.sort),
  );
}

// --------------------------------------------------------------------------
//  Listagem com filtros
// --------------------------------------------------------------------------
function applyClientFilters(list: Product[], f: CatalogFilters): Product[] {
  let out = list.filter((p) => p.active);

  if (f.kind) out = out.filter((p) => p.category.kind === f.kind);
  if (f.categorySlug) out = out.filter((p) => p.category.slug === f.categorySlug);
  if (f.gender) out = out.filter((p) => p.gender === f.gender || p.gender === "unissex");
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }
  if (f.sizes?.length) {
    out = out.filter((p) =>
      p.variants.some((v) => v.size && f.sizes!.includes(v.size)),
    );
  }
  if (f.minPrice != null) out = out.filter((p) => p.price_from >= f.minPrice!);
  if (f.maxPrice != null) out = out.filter((p) => p.price_from <= f.maxPrice!);
  if (f.ageMonths != null) {
    out = out.filter((p) => {
      const min = p.age_min_months ?? 0;
      const max = p.age_max_months ?? 1200;
      return f.ageMonths! >= min && f.ageMonths! <= max;
    });
  }

  switch (f.sort) {
    case "preco-asc":
      out.sort((a, b) => a.price_from - b.price_from);
      break;
    case "preco-desc":
      out.sort((a, b) => b.price_from - a.price_from);
      break;
    default:
      break;
  }
  return out;
}

export async function listProducts(f: CatalogFilters = {}): Promise<Product[]> {
  return withFallback(
    async () => {
      const supabase = await createClient();
      let query = supabase.from("products").select(PRODUCT_SELECT).eq("active", true);

      if (f.categorySlug) query = query.eq("category.slug", f.categorySlug);
      if (f.kind) query = query.eq("category.kind", f.kind);
      if (f.q) query = query.ilike("name", `%${f.q}%`);
      if (f.sort === "novidades") query = query.order("created_at", { ascending: false });

      const { data, error } = await query.limit(200);
      if (error) throw error;

      // filtros que dependem das variações são aplicados no cliente
      return applyClientFilters((data ?? []).map(mapProduct), {
        ...f,
        categorySlug: undefined,
        kind: undefined,
        q: undefined,
      });
    },
    () => applyClientFilters(mockDB().products, f),
  );
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const all = await listProducts({ sort: "novidades" });
  return all.filter((p) => p.in_stock).slice(0, limit);
}

// --------------------------------------------------------------------------
//  Produto único
// --------------------------------------------------------------------------
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return withFallback(
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data) : null;
    },
    () => mockDB().products.find((p) => p.slug === slug && p.active) ?? null,
  );
}

export async function getAllProductSlugs(): Promise<string[]> {
  return withFallback(
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("products")
        .select("slug")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []).map((r) => r.slug as string);
    },
    () => mockDB().products.map((p) => p.slug),
  );
}

/** Tamanhos distintos disponíveis (para o painel de filtros). */
export async function getAvailableSizes(kind?: string): Promise<string[]> {
  const products = await listProducts(kind ? { kind: kind as CatalogFilters["kind"] } : {});
  const set = new Set<string>();
  for (const p of products) for (const v of p.variants) if (v.size) set.add(v.size);
  return [...set];
}
