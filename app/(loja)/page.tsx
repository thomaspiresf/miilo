import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listProducts } from "@/lib/data/catalog";
import { explodeByColor } from "@/lib/product-cards";
import { ProductRow } from "@/components/site/product-row";
import { HeroBanner } from "@/components/site/hero-banner";
import { CategoryPills } from "@/components/site/category-pills";
import { EmptyState } from "@/components/ui/misc";
import { CATEGORY_KINDS, KIND_LABELS } from "@/lib/types";

// Vitrine igual pra todo mundo: pré-renderada e revalidada a cada 60s.
export const revalidate = 60;

const PER_ROW = 12;

export default async function HomePage() {
  const products = await listProducts(); // padrão: ordem alfabética
  const items = explodeByColor(products); // um card por cor na vitrine

  const sections = CATEGORY_KINDS.map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    items: items.filter((it) => it.product.category.kind === kind),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="space-y-8">
      <HeroBanner />

      <div className="sticky top-[57px] z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <CategoryPills active="tudo" />
      </div>

      {sections.length === 0 ? (
        <EmptyState title="Em breve" description="Estamos preparando a vitrine." />
      ) : (
        sections.map((s) => (
          <section key={s.kind}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-xl font-black">{s.label}</h2>
              <Link
                href={`/c/${s.kind}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Ver todos ({s.items.length})
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ProductRow items={s.items.slice(0, PER_ROW)} />
          </section>
        ))
      )}

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-3">
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
