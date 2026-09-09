import Image from "next/image";
import { ImageOff } from "lucide-react";
import { adminListVariants, adminRecentStockMovements } from "@/lib/data/admin";
import { StockTable } from "@/components/admin/stock-table";
import { formatDateTime } from "@/lib/format";

const REASON_LABEL: Record<string, string> = {
  sale: "Venda",
  cancellation: "Cancelamento",
  adjustment: "Ajuste manual",
  restock: "Reposição",
  reservation: "Reserva (checkout)",
  reservation_release: "Reserva devolvida",
};

export default async function AdminStockPage(props: PageProps<"/admin/estoque">) {
  const sp = await props.searchParams;
  const f = sp.f === "low" || sp.f === "out" ? sp.f : "all";

  const [rows, movements] = await Promise.all([
    adminListVariants(),
    adminRecentStockMovements(24),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black">Estoque</h1>
        <p className="text-sm text-muted">
          Ajuste o estoque de cada variação. A baixa por venda e a devolução por
          cancelamento são automáticas.
        </p>
      </div>

      <StockTable rows={rows} initialFilter={f} />

      <section>
        <h2 className="mb-3 font-black">Movimentações recentes</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma movimentação registrada ainda. (Se acabou de configurar,
            rode <code>supabase/migration-stock.sql</code> no SQL Editor.)
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-sm">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-black/[0.03]">
                  {m.product_image ? (
                    <Image
                      src={m.product_image}
                      alt={m.product_name ?? ""}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted">
                      <ImageOff className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.product_name ?? "—"}
                    {m.variant_label ? ` · ${m.variant_label}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {REASON_LABEL[m.reason] ?? m.reason}
                    {m.note ? ` — ${m.note}` : ""} · {formatDateTime(m.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-right font-bold ${
                    m.delta < 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                {m.balance_after != null && (
                  <span className="w-10 shrink-0 text-right text-xs text-muted">
                    → {m.balance_after}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
