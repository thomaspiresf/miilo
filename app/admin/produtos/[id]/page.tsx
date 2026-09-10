import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetProduct, adminListCategories } from "@/lib/data/admin";
import { listStockAlerts } from "@/lib/data/stock-alerts";
import { ProductForm } from "@/components/admin/product-form";
import { ImageUploader } from "@/components/admin/image-uploader";
import { VideoUploader } from "@/components/admin/video-uploader";
import { addImageUrlAction } from "@/app/admin/actions";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

export default async function AdminProductEditPage(
  props: PageProps<"/admin/produtos/[id]">,
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === "novo";
  const justCreated = sp?.criado === "1";

  const [product, categories] = await Promise.all([
    isNew ? Promise.resolve(null) : adminGetProduct(id),
    adminListCategories(),
  ]);

  if (!isNew && !product) notFound();

  const alerts = product ? await listStockAlerts(product.id) : [];

  const colors: { name: string; hex: string | null }[] = [];
  if (product) {
    const seen = new Set<string>();
    for (const v of product.variants) {
      if (v.color && !seen.has(v.color.toLowerCase())) {
        seen.add(v.color.toLowerCase());
        colors.push({ name: v.color, hex: v.color_hex });
      }
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/produtos" className="text-sm text-primary">
          ← Produtos
        </Link>
        <h1 className="mt-1 text-2xl font-black">
          {isNew ? "Novo produto" : product!.name}
        </h1>
        {isNew && (
          <p className="mt-1 text-sm text-muted">
            Preencha os dados e salve. O preço e o estoque ficam mais abaixo (o
            formulário se ajusta se for roupa ou brinquedo). As fotos você adiciona
            na etapa seguinte.
          </p>
        )}
      </div>

      {justCreated && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          Produto criado! Agora adicione as fotos na seção abaixo. ↓
        </p>
      )}

      <ProductForm product={product} categories={categories} />

      {product && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-1 font-bold">Fotos</h2>
          <p className="mb-4 text-xs text-muted">
            Adicione as fotos de cada cor no bloco dela. A 1ª foto de cada cor é
            a que aparece na vitrine quando o produto é mostrado separado por cor.
          </p>
          <ImageUploader productId={product.id} images={product.images} colors={colors} />

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-muted">
              Adicionar por URL
            </summary>
            <form action={addImageUrlAction} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <input
                name="url"
                placeholder="https://…"
                className="h-10 min-w-40 flex-1 rounded-lg border border-border px-3 text-sm"
              />
              {colors.length > 0 && (
                <select
                  name="color"
                  defaultValue=""
                  className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
                >
                  <option value="">Sem cor específica</option>
                  {colors.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <Button type="submit" size="sm" variant="outline">
                Adicionar
              </Button>
            </form>
          </details>
        </section>
      )}

      {product && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-1 font-bold">Vídeo (opcional)</h2>
          <p className="mb-3 text-xs text-muted">
            Aparece logo depois da primeira foto na galeria da página do produto.
          </p>
          <VideoUploader
            productId={product.id}
            video={product.video_url}
            muted={product.video_muted}
          />
        </section>
      )}

      {product && alerts.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-bold">
            Lista de espera{" "}
            <span className="text-muted">({alerts.length})</span>
          </h2>
          <p className="mb-3 text-xs text-muted">
            Clientes que pediram pra ser avisados quando o produto voltar. Quando
            repor o estoque, avise essas pessoas.
          </p>
          <ul className="divide-y divide-border text-sm">
            {alerts.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 py-2">
                <a href={`mailto:${a.email}`} className="font-medium text-primary">
                  {a.email}
                </a>
                <span className="text-xs text-muted">
                  {a.variantLabel ? `${a.variantLabel} · ` : ""}
                  {formatDate(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
