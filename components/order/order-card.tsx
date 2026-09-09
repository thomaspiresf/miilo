import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Order } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { Badge } from "@/components/ui/misc";

function Body({ order }: { order: Order }) {
  const status = ORDER_STATUS[order.status];
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">{order.number}</p>
          <p className="text-xs text-muted">{formatDate(order.created_at)}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {order.items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            className="relative h-11 w-11 overflow-hidden rounded-lg bg-black/5"
          >
            {it.image_url && (
              <Image src={it.image_url} alt="" fill sizes="44px" className="object-cover" />
            )}
          </div>
        ))}
        {order.items.length > 4 && (
          <span className="text-xs text-muted">+{order.items.length - 4}</span>
        )}
        <span className="ml-auto font-bold">{formatBRL(order.total)}</span>
      </div>
    </>
  );
}

export function OrderCard({
  order,
  href,
  bare = false,
}: {
  order: Order;
  href: string;
  /** true = sem borda/link no card todo (a página cuida do container). */
  bare?: boolean;
}) {
  if (bare) {
    return (
      <div>
        <Body order={order} />
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-primary"
        >
          Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-primary"
    >
      <Body order={order} />
    </Link>
  );
}
