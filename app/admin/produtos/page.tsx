import Link from "next/link";
import { FolderTree, TicketPercent } from "lucide-react";
import { adminListProducts } from "@/lib/data/admin";
import { AdminProductList } from "@/components/admin/admin-product-list";
import { Button } from "@/components/ui/button";

export default async function AdminProductsPage() {
  const products = await adminListProducts();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Produtos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/categorias">
              <FolderTree className="h-4 w-4" />
              Categorias
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/cupons">
              <TicketPercent className="h-4 w-4" />
              Cupons
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/produtos/novo">Novo produto</Link>
          </Button>
        </div>
      </div>

      <AdminProductList products={products} />
    </div>
  );
}
