import type { Metadata } from "next";
import { getAvailableSizes, listProducts } from "@/lib/data/catalog";
import { parseFilters } from "@/lib/data/parse-filters";
import { ProductGrid } from "@/components/site/product-card";
import { Filters } from "@/components/site/filters";
import { MobileFilters } from "@/components/site/mobile-filters";
import { SearchBox } from "@/components/site/search-box";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Busca" };

export default async function SearchPage(props: PageProps<"/busca">) {
  const sp = await props.searchParams;
  const filters = parseFilters(sp);
  const q = filters.q ?? "";

  const [products, sizes] = await Promise.all([
    listProducts(filters),
    getAvailableSizes(),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black">Busca</h1>
        <div className="mt-3 max-w-md">
          <SearchBox defaultValue={q} />
        </div>
        {q && (
          <p className="mt-2 text-sm text-muted">
            {products.length} resultados para “{q}”
          </p>
        )}
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
          {products.length === 0 ? (
            <EmptyState
              title={q ? "Nenhum produto encontrado" : "O que você procura?"}
              description={q ? "Tente outras palavras." : "Digite acima para buscar."}
            />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  );
}
