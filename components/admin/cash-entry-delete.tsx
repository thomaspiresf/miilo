"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCashEntryAction } from "@/app/admin/gastos/cash-actions";

export function CashEntryDelete({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label="Apagar movimentação"
        onClick={() => {
          if (!window.confirm(`Apagar a movimentação "${label}"?`)) return;
          setError(null);
          startTransition(async () => {
            const res = await deleteCashEntryAction(id);
            if (!res.ok) setError(res.error ?? "Falha ao apagar");
            else router.refresh();
          });
        }}
        className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
