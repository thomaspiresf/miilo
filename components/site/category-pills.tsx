"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind } from "@/lib/types";

const LEVEL1 = [
  { slug: "tudo", label: "Tudo", href: "/" },
  { slug: "roupas", label: "Roupas", href: "/c/roupas" },
  { slug: "brinquedos", label: "Brinquedos", href: "/c/brinquedos" },
] as const;

/** Filtro principal: Tudo · Roupas · Brinquedos (a ativa em rosa). */
export function CategoryPills({
  active,
}: {
  active: "tudo" | CategoryKind;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      {LEVEL1.map((it) => {
        const on = active === it.slug;
        return (
          <Link
            key={it.slug}
            href={it.href}
            className={cn(
              "shrink-0 rounded-full border px-5 py-2 text-sm font-bold transition",
              on
                ? "border-pink bg-pink text-white"
                : "border-border bg-surface text-foreground hover:border-foreground/30",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Segundo nível: subcategorias de uma linha (ex.: Bodies · Conjuntos · Mijão · Shorts). */
export function SubcategoryPills({
  kind,
  categories,
  activeSlug,
}: {
  kind: CategoryKind;
  categories: Category[];
  activeSlug?: string;
}) {
  const subs = categories.filter((c) => c.kind === kind).sort((a, b) => a.sort - b.sort);
  if (subs.length === 0) return null;

  const current = activeSlug ?? kind;
  const items = [
    { slug: kind, label: "Todos", href: `/c/${kind}` },
    ...subs.map((c) => ({ slug: c.slug, label: c.name, href: `/c/${c.slug}` })),
  ];

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      {items.map((it) => {
        const on = current === it.slug;
        return (
          <Link
            key={it.slug}
            href={it.href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              on
                ? "bg-foreground text-background"
                : "text-muted hover:bg-black/[0.04]",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
