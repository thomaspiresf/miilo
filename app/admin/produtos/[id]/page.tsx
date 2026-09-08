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
  const isNew = id === "novo";

  const [product, categories] = await Promise.all([
    isNew ? Promise.resolve(null) : adminGetProduct(id),
    adminListCategories(),
  ]);

  if (!isNew && !product) notFound();

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
            Preencha os dados e salve. Depois de criado, você adiciona as fotos.
          </p>
        )}
      </div>

      <ProductForm product={product} categories={categories} />

      {product && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 font-bold">Fotos</h2>
          <ImageUploader productId={product.id} images={product.images} />

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-muted">
              Adicionar por URL
            </summary>
            <form action={addImageUrlAction} className="mt-2 flex gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <input
                name="url"
                placeholder="https://…"
                className="h-10 flex-1 rounded-lg border border-border px-3 text-sm"
              />
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
