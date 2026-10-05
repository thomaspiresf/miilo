"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { copyFixedAction, deleteExpenseAction, setExpenseItemTypeAction, setExpensePayerAction } from "@/app/admin/gastos/actions";
import { EXPENSE_ITEM_TYPES, EXPENSE_PAYERS, ITEM_TYPE_LABELS, PAYER_LABELS, type ExpenseItemType, type ExpensePayer } from "@/lib/expenses";
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

export function PayerSelect({ id, payer }: { id: string; payer: ExpensePayer | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(value: string) {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const res = await setExpensePayerAction(id, value);
      if (!res.ok) setError(res.error ?? "Falha ao salvar");
      else router.refresh();
    });
  }

  return (
    <span className="shrink-0">
      <select
        aria-label="Quem pagou"
        value={payer ?? ""}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className={`h-8 max-w-36 rounded-lg border bg-surface px-1.5 text-xs font-semibold outline-none disabled:opacity-50 ${
          payer ? "border-border" : "border-warning text-warning"
        }`}
      >
        {!payer && <option value="">Quem pagou?</option>}
        {EXPENSE_PAYERS.map((p) => (
          <option key={p} value={p}>
            {PAYER_LABELS[p]}
          </option>
        ))}
      </select>
      {error && <span className="ml-1 text-xs text-danger">{error}</span>}
    </span>
  );
}

export function ItemTypeSelect({ id, itemType }: { id: string; itemType: ExpenseItemType | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(value: string) {
    setError(null);
    startTransition(async () => {
      const res = await setExpenseItemTypeAction(id, value);
      if (!res.ok) setError(res.error ?? "Falha ao salvar");
      else router.refresh();
    });
  }

  return (
    <span className="shrink-0">
      <select
        aria-label="Tipo do gasto"
        value={itemType ?? ""}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="h-8 max-w-28 rounded-lg border border-border bg-surface px-1.5 text-xs font-semibold outline-none disabled:opacity-50"
      >
        <option value="">Sem tipo</option>
        {EXPENSE_ITEM_TYPES.map((t) => (
          <option key={t} value={t}>
            {ITEM_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      {error && <span className="ml-1 text-xs text-danger">{error}</span>}
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
