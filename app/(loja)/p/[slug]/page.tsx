import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProductSlugs, getProductBySlug, listProducts } from "@/lib/data/catalog";
import { listReviewsForProduct } from "@/lib/data/reviews";
import { formatAgeRange } from "@/lib/format";
import { ProductDetail } from "@/components/site/product-detail";
import { ProductReviews } from "@/components/site/product-reviews";
import { getInstallmentsForPrices } from "@/lib/mp-installments";
import { toCardItem } from "@/lib/product-cards";
import { ProductGrid } from "@/components/site/product-card";
import { Rating } from "@/components/site/rating";
import { ExpandableText } from "@/components/site/expandable-text";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/misc";

export async function generateStaticParams() {
  try {
    const slugs = await getAllProductSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata(
  props: PageProps<"/p/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // ?cor= vindo da vitrine → cor inicial (normaliza pro nome exato da variação)
  const rawColor = typeof sp.cor === "string" ? sp.cor : null;
  const initialColor = rawColor
    ? (product.variants.find(
        (v) => v.color && v.color.toLowerCase() === rawColor.toLowerCase(),
      )?.color ?? null)
    : null;

  const related = (await listProducts({ categorySlug: product.category.slug }))
    .filter((p) => p.id !== product.id)
    .slice(0, 4)
    .map(toCardItem);

  const age = formatAgeRange(product.age_min_months, product.age_max_months);
  const installments = await getInstallmentsForPrices([
    product.price_from,
    ...product.variants.map((v) => v.price),
  ]);
  const reviews = await listReviewsForProduct(product.id);

  return (
    <div className="space-y-12">
      <nav className="text-xs text-muted">
        <Link href="/">Início</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/c/${product.category.slug}`}>{product.category.name}</Link>
      </nav>

      <ProductDetail
        product={product}
        installments={installments}
        initialColor={initialColor}
        info={
          <>
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {product.brand}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-black leading-tight">{product.name}</h1>

            <div className="mt-2">
              <Rating avg={product.rating_avg} count={product.rating_count} size="md" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {age && <Badge tone="neutral">{age}</Badge>}
              {product.gender && product.gender !== "unissex" && (
                <Badge tone="neutral">{product.gender}</Badge>
              )}
            </div>
          </>
        }
      />

      {/* Sobre o produto */}
      <section className="max-w-2xl">
        <h2 className="mb-3 text-lg font-black">
          {product.category.kind === "brinquedos"
            ? "Sobre o brinquedo"
            : product.category.kind === "livros"
              ? "Sobre o livro"
              : "Sobre a peça"}
        </h2>
        {product.composition && (
          <p className="mb-2 text-sm">
            <span className="font-bold">Composição:</span>{" "}
            <span className="text-muted">{product.composition}</span>
          </p>
        )}
        {product.material && (
          <p className="mb-2 text-sm">
            <span className="font-bold">Material:</span>{" "}
            <span className="text-muted">{product.material}</span>
          </p>
        )}
        {product.dimensions && (
          <p className="mb-2 text-sm">
            <span className="font-bold">Medidas:</span>{" "}
            <span className="text-muted">{product.dimensions}</span>
          </p>
        )}
        {product.description && <ExpandableText text={product.description} />}

        <div className="mt-4">
          {product.fit_notes && (
            <Accordion title="Modelagem">
              <p className="whitespace-pre-line">{product.fit_notes}</p>
            </Accordion>
          )}
          {product.care_notes && (
            <Accordion title={product.category.kind === "brinquedos" ? "Cuidados e segurança" : "Cuidados"}>
              <p className="whitespace-pre-line">{product.care_notes}</p>
            </Accordion>
          )}
          <Accordion title="Trocas e devoluções">
            Você tem 7 dias corridos após o recebimento para solicitar troca ou
            devolução, com a peça sem uso e com etiqueta. É só falar com a gente.
          </Accordion>
        </div>
      </section>

      <ProductReviews reviews={reviews} />

      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-black">Você também pode gostar</h2>
          <ProductGrid items={related} />
        </section>
      )}
    </div>
  );
}
