"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, Search } from "lucide-react";
import type { CategoryKind, Product } from "@/lib/types";
import { CATEGORY_KINDS, KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import {
  toggleProductActiveAction,
  deleteProductAction,
} from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";

type Status = "all" | "active" | "inactive";
type Sort = "name" | "recent" | "price-asc" | "price-desc" | "stock-asc";

const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Nome (A–Z)" },
  { id: "recent", label: "Mais recentes" },
  { id: "price-asc", label: "Preço ↑" },
  { id: "price-desc", label: "Preço ↓" },
  { id: "stock-asc", label: "Menos estoque" },
];

export function AdminProductList({ products }: { products: Product[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<CategoryKind | "all">("all");
  const [categorySlug, setCategorySlug] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("name");

  // subcategorias existentes para o kind escolhido
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (kind !== "all" && p.category.kind !== kind) continue;
      map.set(p.category.slug, p.category.name);
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products, kind]);

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { all: products.length };
    for (const k of CATEGORY_KINDS) c[k] = 0;
    for (const p of products) c[p.category.kind] = (c[p.category.kind] ?? 0) + 1;
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = products.filter((p) => {
      if (kind !== "all" && p.category.kind !== kind) return false;
      if (categorySlug !== "all" && p.category.slug !== categorySlug) return false;
      if (status === "active" && !p.active) return false;
      if (status === "inactive" && p.active) return false;
      if (term) {
        const hay = [
          p.name,
          p.brand ?? "",
          p.category.name,
          ...p.variants.map((v) => v.sku ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    const stockOf = (p: Product) => p.variants.reduce((s, v) => s + v.stock, 0);
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "recent":
          return 0; // já vem por created_at desc do servidor
        case "price-asc":
          return a.price_from - b.price_from;
        case "price-desc":
          return b.price_from - a.price_from;
        case "stock-asc":
          return stockOf(a) - stockOf(b);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [products, q, kind, categorySlug, status, sort]);

  const kinds: { id: CategoryKind | "all"; label: string }[] = [
    { id: "all", label: `Tudo (${kindCounts.all})` },
    ...CATEGORY_KINDS.map((k) => ({
      id: k,
      label: `${KIND_LABELS[k]} (${kindCounts[k] ?? 0})`,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* busca */}
      <div className="flex items-center rounded-full border border-border bg-surface px-3 sm:max-w-sm">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produto, marca ou SKU"
          className="h-10 w-full bg-transparent px-2 text-sm outline-none"
        />
      </div>

      {/* kind pills */}
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              setKind(k.id);
              setCategorySlug("all");
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              kind === k.id
                ? "bg-foreground text-background"
                : "border border-border bg-surface",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* selects */}
      <div className="flex flex-wrap gap-2">
        {categories.length > 1 && (
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
          >
            <option value="all">Todas as categorias</option>
            {categories.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
        >
          <option value="all">Ativos e inativos</option>
          <option value="active">Só ativos</option>
          <option value="inactive">Só inativos</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted">
        {filtered.length === products.length
          ? `${products.length} produtos`
          : `${filtered.length} de ${products.length} produtos`}
      </p>

      {/* lista */}
      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {filtered.map((p) => {
          const stock = p.variants.reduce((s, v) => s + v.stock, 0);
          return (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
                {p.images[0]?.url ? (
                  <Image
                    src={p.images[0].url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/produtos/${p.id}`}
                  className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary"
                >
                  {p.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {p.category.name} · {p.variants.length} var. ·{" "}
                  <span className={stock === 0 ? "font-semibold text-danger" : ""}>
                    {stock} em estoque
                  </span>
                  {!p.active && (
                    <span className="ml-1 font-semibold text-danger">· inativo</span>
                  )}
                </p>
              </div>
              <span className="hidden shrink-0 text-sm font-bold sm:block">
                {formatBRL(p.price_from)}
              </span>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <form action={toggleProductActiveAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={p.active ? "false" : "true"}
                  />
                  <button className="text-xs font-semibold text-primary">
                    {p.active ? "desativar" : "ativar"}
                  </button>
                </form>
                <form action={deleteProductAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmit
                    message={`Apagar "${p.name}" de vez? Isso não pode ser desfeito. (O histórico de pedidos é mantido.)`}
                    className="text-xs font-semibold text-danger hover:underline"
                  >
                    apagar
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            {products.length === 0
              ? "Nenhum produto cadastrado."
              : "Nenhum produto com esses filtros."}
          </p>
        )}
      </div>
    </div>
  );
}
