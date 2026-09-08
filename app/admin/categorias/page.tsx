import { adminListCategories, adminListProducts } from "@/lib/data/admin";
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
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted">
                /{c.slug} · {c.kind}
              </p>
            </div>
            <span className="text-muted">{count(c.id)} produtos</span>
          </div>
        ))}
      </div>

      <CategoryForm />
    </div>
  );
}
