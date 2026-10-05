import { adminListCategories, adminListProducts } from "@/lib/data/admin";
import { InvoiceImportDialog } from "@/components/admin/invoice-import-dialog";
import type { ExistingProduct } from "@/lib/invoice-types";

/** Botão "Cadastrar por nota": carrega categorias e produtos existentes e abre a tela de revisão. */
export async function InvoiceImport({ variant }: { variant?: "outline" | "primary" }) {
  const [categories, products] = await Promise.all([adminListCategories(), adminListProducts()]);
  const existing: ExistingProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: [v.size, v.color].filter(Boolean).join(" · ") || "Único",
      size: v.size,
      stock: v.stock,
    })),
  }));
  return (
    <InvoiceImportDialog
      variant={variant}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      existing={existing}
    />
  );
}
