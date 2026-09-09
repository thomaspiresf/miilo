import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin, isProd } from "@/lib/env";
import { seedCategories, seedProducts } from "@/lib/data/seed";

/**
 * Popula o banco com o catálogo de exemplo (categorias + produtos + variações
 * + imagens). Idempotente: pula produtos cujo slug já existe.
 *
 *   curl -X POST "http://localhost:3000/api/dev/seed?token=SEED_TOKEN"
 *
 * Exige a chave service_role configurada. Depois é só editar/apagar pelo /admin.
 */
export async function POST(request: Request) {
  // rota de bootstrap de catálogo — não fica exposta em produção
  if (isProd && process.env.ALLOW_SEED !== "true") {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }
  if (!hasSupabaseAdmin()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const report: Record<string, unknown> = { categories: 0, products: 0, skipped: [] };

  // categorias (upsert por slug)
  const { error: catErr } = await admin
    .from("categories")
    .upsert(
      seedCategories.map((c) => ({
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        sort: c.sort,
      })),
      { onConflict: "slug" },
    );
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
  report.categories = seedCategories.length;

  const { data: catRows } = await admin.from("categories").select("id, slug");
  const catId = new Map((catRows ?? []).map((c) => [c.slug, c.id as string]));

  const { data: existing } = await admin.from("products").select("slug");
  const existingSlugs = new Set((existing ?? []).map((p) => p.slug as string));

  for (const p of seedProducts) {
    if (existingSlugs.has(p.slug)) {
      (report.skipped as string[]).push(p.slug);
      continue;
    }
    const category_id = catId.get(p.category.slug);
    if (!category_id) continue;

    const { data: prod, error: prodErr } = await admin
      .from("products")
      .insert({
        slug: p.slug,
        name: p.name,
        description: p.description,
        category_id,
        brand: p.brand,
        gender: p.gender,
        age_min_months: p.age_min_months,
        age_max_months: p.age_max_months,
        base_price: p.base_price,
        compare_at_price: p.compare_at_price,
        composition: p.composition,
        material: p.material,
        dimensions: p.dimensions,
        fit_notes: p.fit_notes,
        care_notes: p.care_notes,
        rating_avg: p.rating_avg,
        rating_count: p.rating_count,
        max_installments: p.max_installments,
        active: true,
      })
      .select("id")
      .single();
    if (prodErr) return NextResponse.json({ error: prodErr.message, at: p.slug }, { status: 500 });

    await admin.from("product_variants").insert(
      p.variants.map((v) => ({
        product_id: prod.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        color_hex: v.color_hex,
        price: v.price,
        stock: v.stock,
        weight_grams: v.weight_grams,
      })),
    );
    await admin.from("product_images").insert(
      p.images.map((im) => ({
        product_id: prod.id,
        storage_path: im.url,
        alt: im.alt,
        sort: im.sort,
      })),
    );
    report.products = (report.products as number) + 1;
  }

  return NextResponse.json({ ok: true, ...report });
}
