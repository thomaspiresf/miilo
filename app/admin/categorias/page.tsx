import { adminListCategories, adminListProducts } from "@/lib/data/admin";
import { deleteCategoryAction } from "@/app/admin/actions";
import { CategoryForm } from "@/components/admin/category-form";

export default async function AdminCategoriesPage() {
  const [categories, products] = await Promise.all([
    adminListCategories(),
    adminListProducts(),
  ]);

  const count = (id: string) => products.filter((p) => p.category.id === id).length;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-black">Categorias</h1>

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {categories.map((c) => {
          const n = count(c.id);
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted">
                  /{c.slug} · {c.kind}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted">{n} produtos</span>
                {n === 0 && (
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs font-semibold text-danger hover:underline">
                      excluir
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CategoryForm />
    </div>
  );
}
