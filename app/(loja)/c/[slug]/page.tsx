import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAvailableSizes,
  getCategories,
  listProducts,
} from "@/lib/data/catalog";
import { parseFilters } from "@/lib/data/parse-filters";
import { explodeByColor } from "@/lib/product-cards";
import { ProductGrid } from "@/components/site/product-card";
import { CategoryPills, SubcategoryPills } from "@/components/site/category-pills";
import { Filters } from "@/components/site/filters";
import { MobileFilters } from "@/components/site/mobile-filters";
import { EmptyState } from "@/components/ui/misc";
import { CATEGORY_KINDS, KIND_LABELS, type CategoryKind } from "@/lib/types";

async function resolve(slug: string) {
  if (CATEGORY_KINDS.includes(slug as CategoryKind)) {
    return {
      kind: slug as CategoryKind,
      title: KIND_LABELS[slug as CategoryKind],
      categorySlug: undefined,
    };
  }
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return null;
  return { kind: cat.kind, title: cat.name, categorySlug: cat.slug };
}

export async function generateMetadata(
  props: PageProps<"/c/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const r = await resolve(slug);
  return { title: r?.title ?? "Categoria" };
}

export default async function CategoryPage(props: PageProps<"/c/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const r = await resolve(slug);
  if (!r) notFound();

  const filters = { ...parseFilters(sp), kind: r.kind, categorySlug: r.categorySlug };
  const [products, sizes, categories] = await Promise.all([
    listProducts(filters),
    getAvailableSizes(r.kind),
    getCategories(),
  ]);
  const items = explodeByColor(products);

  return (
    <div>
      <div className="mb-3">
        <CategoryPills active={r.kind} />
      </div>
      <div className="mb-4">
        <SubcategoryPills
          kind={r.kind}
          categories={categories}
          activeSlug={r.categorySlug}
        />
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-black">{r.title}</h1>
        <p className="text-sm text-muted">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </p>
      </header>

      <div className="mb-4 lg:hidden">
        <MobileFilters sizes={sizes} />
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-28">
            <Filters sizes={sizes} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {items.length === 0 ? (
            <EmptyState
              title="Nada por aqui com esses filtros"
              description="Tente remover alguns filtros."
            />
          ) : (
            <ProductGrid items={items} />
          )}
        </div>
      </div>
    </div>
  );
}
