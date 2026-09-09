import Link from "next/link";
import { adminListProducts } from "@/lib/data/admin";
import { AdminProductList } from "@/components/admin/admin-product-list";
import { Button } from "@/components/ui/button";

export default async function AdminProductsPage() {
  const products = await adminListProducts();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Produtos</h1>
        <Button asChild size="sm">
          <Link href="/admin/produtos/novo">Novo produto</Link>
        </Button>
      </div>

      <AdminProductList products={products} />
    </div>
  );
}
