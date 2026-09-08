import Link from "next/link";
import Image from "next/image";
import { adminListProducts } from "@/lib/data/admin";
import { formatBRL } from "@/lib/format";
import { toggleProductActiveAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/misc";
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

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {products.map((p) => {
          const stock = p.variants.reduce((s, v) => s + v.stock, 0);
          return (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
                {p.images[0]?.url && (
                  <Image src={p.images[0].url} alt="" fill sizes="56px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/produtos/${p.id}`} className="font-semibold hover:text-primary">
                  {p.name}
                </Link>
                <p className="text-xs text-muted">
                  {p.category.name} · {p.variants.length} variações · {stock} em estoque
                </p>
              </div>
              <span className="hidden text-sm font-bold sm:block">
                {formatBRL(p.price_from)}
              </span>
              {!p.active && <Badge tone="danger">inativo</Badge>}
              <form action={toggleProductActiveAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                <button className="text-xs font-semibold text-primary">
                  {p.active ? "desativar" : "ativar"}
                </button>
              </form>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Nenhum produto cadastrado.</p>
        )}
      </div>
    </div>
  );
}
