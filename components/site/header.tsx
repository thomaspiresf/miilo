"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import type { Category } from "@/lib/types";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { CartSheet } from "@/components/site/cart-sheet";
import { CartCount } from "@/components/site/cart-count";
import { Logo } from "@/components/site/logo";

export function SiteHeader({
  categories,
  user,
}: {
  categories: Category[];
  user: { name: string | null; email: string | null; isAdmin?: boolean } | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const roupas = categories.filter((c) => c.kind === "roupas");
  const brinquedos = categories.filter((c) => c.kind === "brinquedos");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/busca?q=${encodeURIComponent(term)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        {/* menu mobile */}
        <Sheet>
          <SheetTrigger
            aria-label="Abrir menu"
            className="rounded-full p-2 hover:bg-black/5 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" title="Categorias">
            <nav className="flex flex-col p-2">
              <MenuGroup label="Roupas" items={roupas} basePath="roupas" />
              <MenuGroup label="Brinquedos" items={brinquedos} basePath="brinquedos" />
              <SheetClose asChild>
                <Link href="/conta" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-black/5">
                  Minha conta
                </Link>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" aria-label="miilo — início">
          <Logo variant="icon" className="h-6 w-auto" priority />
        </Link>

        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-md md:flex">
          <div className="flex w-full items-center rounded-full border border-border bg-surface px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produtos"
              className="h-10 w-full bg-transparent px-2 text-sm outline-none"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="mr-1 hidden rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background sm:block"
            >
              admin
            </Link>
          )}
          <Link
            href="/busca"
            aria-label="Buscar"
            className="rounded-full p-2 hover:bg-black/5 md:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/conta"
            aria-label="Minha conta"
            className="rounded-full p-2 hover:bg-black/5"
            title={user?.email ?? "Entrar"}
          >
            <User className="h-5 w-5" />
          </Link>
          <CartSheet>
            <button aria-label="Abrir sacola" className="relative rounded-full p-2 hover:bg-black/5">
              <ShoppingBag className="h-5 w-5" />
              <CartCount />
            </button>
          </CartSheet>
        </div>
      </div>
    </header>
  );
}

function MenuGroup({
  label,
  items,
  basePath,
}: {
  label: string;
  items: Category[];
  basePath: string;
}) {
  return (
    <div className="mb-2">
      <SheetClose asChild>
        <Link href={`/c/${basePath}`} className="block rounded-lg px-3 py-2.5 font-bold hover:bg-black/5">
          {label}
        </Link>
      </SheetClose>
      {items.map((c) => (
        <SheetClose asChild key={c.id}>
          <Link href={`/c/${c.slug}`} className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-black/5">
            {c.name}
          </Link>
        </SheetClose>
      ))}
    </div>
  );
}
