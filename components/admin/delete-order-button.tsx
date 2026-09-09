"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAction } from "@/app/admin/actions";
import { Spinner } from "@/components/ui/misc";

export function DeleteOrderButton({
  orderId,
  number,
}: {
  orderId: string;
  number: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    if (!window.confirm(`Apagar o pedido ${number} para sempre? Não dá pra desfazer.`)) return;
    setLoading(true);
    setError(null);
    const res = await deleteOrderAction(orderId);
    if ("error" in res) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/admin/pedidos");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="mt-3 flex items-center gap-2 rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
      >
        {loading ? <Spinner /> : null}
        {loading ? "Apagando…" : "Apagar pedido"}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
