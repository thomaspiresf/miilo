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
    adminRecentStockMovements(20),
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
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`w-12 shrink-0 text-right font-bold ${
                    m.delta < 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
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
                {m.balance_after != null && (
                  <span className="shrink-0 text-xs text-muted">
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
