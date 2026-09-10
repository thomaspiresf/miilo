import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { env, hasSupabase } from "@/lib/env";
import { mockDB } from "@/lib/data/mock-store";
import { maybeSweepReservations } from "@/lib/data/stock-reservations";
import type { Category, CatalogFilters, Product } from "@/lib/types";

/** Converte um storage_path (path no bucket OU URL absoluta) em URL pública. */
export function imageUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${env.supabase.url}/storage/v1/object/public/product-images/${path}`;
}

const PRODUCT_SELECT = `
  *,
  category:categories!inner(id, slug, name, kind),
  images:product_images(*),
  variants:product_variants(id, sku, size, color, color_hex, price, cost, stock, weight_grams, active)
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapProduct(row: any): Product {
  const images = (row.images ?? [])
    .map((im: any) => ({
      id: im.id,
      url: imageUrl(im.storage_path),
      alt: im.alt ?? null,
      sort: im.sort ?? 0,
      color: im.color ?? null,
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
      cost: v.cost != null ? Number(v.cost) : null,
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
    material: row.material ?? null,
    dimensions: row.dimensions ?? null,
    fit_notes: row.fit_notes ?? null,
    care_notes: row.care_notes ?? null,
    rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
    rating_count: Number(row.rating_count ?? 0),
    max_installments: Number(row.max_installments ?? 3),
    video_url: row.video_url ? imageUrl(row.video_url) : null,
    video_audio: row.video_audio ?? "optional",
    split_by_color: row.split_by_color ?? true,
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
export const getCategories = cache(async (): Promise<Category[]> => {
  return withFallback(
    async () => {
      const supabase = createPublicClient();
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
});

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
    case "novidades":
      // ordem já vem do banco (created_at desc); no mock, mantém a ordem do seed
      break;
    default:
      // padrão em todas as listagens: ordem alfabética por nome
      out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
      break;
  }
  return out;
}

export async function listProducts(f: CatalogFilters = {}): Promise<Product[]> {
  maybeSweepReservations(); // devolve reservas de checkout abandonado (throttled)
  // normaliza a chave: só os campos que mudam a consulta ao banco importam pro
  // cache; o resto é filtrado em memória sobre o mesmo resultado.
  return listProductsCached(f.kind ?? null, f.categorySlug ?? null, f.q ?? null, f.sort ?? null).then(
    (rows) => applyClientFilters(rows, { ...f, categorySlug: undefined, kind: undefined, q: undefined }),
  );
}

const listProductsCached = cache(
  async (
    kind: CatalogFilters["kind"] | null,
    categorySlug: string | null,
    q: string | null,
    sort: CatalogFilters["sort"] | null,
  ): Promise<Product[]> => {
    return withFallback(
      async () => {
        const supabase = createPublicClient();
        let query = supabase.from("products").select(PRODUCT_SELECT).eq("active", true);

        if (categorySlug) query = query.eq("category.slug", categorySlug);
        if (kind) query = query.eq("category.kind", kind);
        if (q) query = query.ilike("name", `%${q}%`);
        if (sort === "novidades") query = query.order("created_at", { ascending: false });
        else query = query.order("name", { ascending: true });

        const { data, error } = await query.limit(200);
        if (error) throw error;
        return (data ?? []).map(mapProduct);
      },
      () =>
        applyClientFilters(mockDB().products, {
          kind: kind ?? undefined,
          categorySlug: categorySlug ?? undefined,
          q: q ?? undefined,
        }),
    );
  },
);

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const all = await listProducts({ sort: "novidades" });
  return all.filter((p) => p.in_stock).slice(0, limit);
}

// --------------------------------------------------------------------------
//  Produto único
// --------------------------------------------------------------------------
export const getProductBySlug = cache(
  async (slug: string): Promise<Product | null> => {
    maybeSweepReservations();
    return withFallback(
      async () => {
        const supabase = createPublicClient();
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
  },
);

export const getAllProductSlugs = cache(async (): Promise<string[]> => {
  return withFallback(
    async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("products")
        .select("slug")
        .eq("active", true);
      if (error) throw error;
      return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
    },
    () => mockDB().products.map((p) => p.slug),
  );
});

/** Tamanhos distintos disponíveis (para o painel de filtros). */
export async function getAvailableSizes(kind?: string): Promise<string[]> {
  const products = await listProducts(kind ? { kind: kind as CatalogFilters["kind"] } : {});
  const set = new Set<string>();
  for (const p of products) for (const v of p.variants) if (v.size) set.add(v.size);
  return [...set];
}
