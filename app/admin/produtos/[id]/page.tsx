import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetProduct, adminListCategories } from "@/lib/data/admin";
import { ProductForm } from "@/components/admin/product-form";
import { ImageUploader } from "@/components/admin/image-uploader";
import { addImageUrlAction } from "@/app/admin/actions";
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

  const colors = product
    ? [...new Set(product.variants.map((v) => v.color).filter((c): c is string => !!c))]
    : [];

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
            Preencha os dados e salve. O preço é definido em cada variação, lá embaixo.
            As fotos você adiciona na etapa seguinte.
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
          <h2 className="mb-3 font-bold">Fotos</h2>
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
                  <option value="">Todas as cores</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
    </div>
  );
}
