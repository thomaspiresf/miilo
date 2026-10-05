"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { copyFixedAction, deleteExpenseAction } from "@/app/admin/gastos/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

export function DeleteExpenseButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!window.confirm(`Apagar o gasto "${description}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteExpenseAction(id);
      if (!res.ok) setError(res.error ?? "Falha ao apagar");
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-label="Apagar gasto"
        className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        {pending ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function CopyFixedButton({ month, count }: { month: string; count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const res = await copyFixedAction(month);
      if (!res.ok) {
        setMessage(res.error ?? "Falha ao copiar");
        return;
      }
      setMessage(res.count ? `${res.count} copiada${res.count === 1 ? "" : "s"}.` : "Nada novo pra copiar.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <span className="min-w-0 flex-1 text-muted">
        {count} conta{count === 1 ? "" : "s"} fixa{count === 1 ? "" : "s"} do mês anterior ainda não lançada
        {count === 1 ? "" : "s"} neste mês.
      </span>
      <Button size="sm" variant="outline" onClick={run} disabled={pending}>
        {pending ? <Spinner /> : <Copy className="h-4 w-4" />}
        Copiar do mês anterior
      </Button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
