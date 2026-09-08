import { listProducts } from "@/lib/data/catalog";
import { ProductGrid } from "@/components/site/product-card";
import { HeroBanner } from "@/components/site/hero-banner";
import { CategoryPills } from "@/components/site/category-pills";
import { EmptyState } from "@/components/ui/misc";

export default async function HomePage() {
  const products = await listProducts({ sort: "novidades" });

  return (
    <div className="space-y-6">
      <HeroBanner />

      <div className="sticky top-[57px] z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <CategoryPills active="tudo" />
      </div>

      {products.length === 0 ? (
        <EmptyState title="Em breve" description="Estamos preparando a vitrine." />
      ) : (
        <ProductGrid products={products} />
      )}

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="font-bold">Frete para todo o Brasil</p>
          <p className="text-muted">Cálculo por CEP no checkout.</p>
        </div>
        <div>
          <p className="font-bold">Pix e cartão</p>
          <p className="text-muted">Pagamento seguro via Mercado Pago.</p>
        </div>
        <div>
          <p className="font-bold">Troca fácil</p>
          <p className="text-muted">7 dias para trocar ou devolver.</p>
        </div>
      </section>
    </div>
  );
}
