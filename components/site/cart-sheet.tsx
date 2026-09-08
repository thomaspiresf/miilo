"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function CartSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" title={`Sacola (${lines.reduce((n, l) => n + l.qty, 0)})`}>
        {lines.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Sua sacola está vazia"
              description="Que tal dar uma olhada nas novidades?"
              action={
                <SheetClose asChild>
                  <Button asChild>
                    <Link href="/c/roupas">Ver produtos</Link>
                  </Button>
                </SheetClose>
              }
            />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <ul className="divide-y divide-border">
              {lines.map((l) => (
                <li key={l.variantId} className="flex gap-3 p-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5">
                    {l.imageUrl && (
                      <Image src={l.imageUrl} alt={l.name} fill className="object-cover" sizes="80px" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/p/${l.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-sm font-semibold"
                    >
                      {l.name}
                    </Link>
                    {l.variantLabel && (
                      <p className="text-xs text-muted">{l.variantLabel}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-border">
                        <button
                          onClick={() => setQty(l.variantId, l.qty - 1)}
                          className="p-1.5"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                        <button
                          onClick={() => setQty(l.variantId, l.qty + 1)}
                          className="p-1.5 disabled:opacity-30"
                          disabled={l.qty >= l.maxStock}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-bold">
                        {formatBRL(l.unitPrice * l.qty)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(l.variantId)}
                    className="self-start p-1 text-muted hover:text-danger"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-auto border-t border-border p-4 pb-safe">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-lg font-black">{formatBRL(subtotal)}</span>
              </div>
              <SheetClose asChild>
                <Button asChild size="lg" className="w-full">
                  <Link href="/checkout">Finalizar compra</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="ghost" className="mt-1 w-full">
                  <Link href="/carrinho">Ver sacola completa</Link>
                </Button>
              </SheetClose>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
