"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function CartPage() {
  const mounted = useHydrated();

  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  if (!mounted) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black">Sacola</h1>

      {lines.length === 0 ? (
        <EmptyState
          title="Sua sacola está vazia"
          description="Adicione roupas e brinquedos para continuar."
          action={
            <Button asChild>
              <Link href="/c/roupas">Explorar produtos</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-4 p-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black/5">
                  {l.imageUrl && (
                    <Image src={l.imageUrl} alt={l.name} fill className="object-cover" sizes="96px" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/p/${l.slug}`}
                      className="line-clamp-2 font-semibold hover:text-primary"
                    >
                      {l.name}
                    </Link>
                    <p className="shrink-0 font-bold">{formatBRL(l.unitPrice * l.qty)}</p>
                  </div>
                  {l.variantLabel && (
                    <p className="text-sm text-muted">{l.variantLabel}</p>
                  )}
                  <p className="mt-1 text-sm text-muted">{formatBRL(l.unitPrice)} / un.</p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-full border border-border">
                      <button onClick={() => setQty(l.variantId, l.qty - 1)} className="p-2" aria-label="Diminuir">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{l.qty}</span>
                      <button
                        onClick={() => setQty(l.variantId, l.qty + 1)}
                        className="p-2 disabled:opacity-30"
                        disabled={l.qty >= l.maxStock}
                        aria-label="Aumentar"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => remove(l.variantId)}
                      className="flex items-center gap-1 text-sm text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-28">
            <h2 className="font-black">Resumo</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-semibold">{formatBRL(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted">Frete</span>
              <span className="text-muted">calculado no checkout</span>
            </div>
            <div className="mt-4 border-t border-border pt-4 flex justify-between">
              <span className="font-bold">Total parcial</span>
              <span className="text-xl font-black">{formatBRL(subtotal)}</span>
            </div>
            <Button asChild size="lg" className="mt-4 w-full">
              <Link href="/checkout">Ir para o checkout</Link>
            </Button>
            <Button asChild variant="ghost" className="mt-1 w-full">
              <Link href="/c/roupas">Continuar comprando</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
