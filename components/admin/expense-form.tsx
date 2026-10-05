"use client";

import { useActionState, useEffect, useRef } from "react";
import { createExpenseAction } from "@/app/admin/gastos/actions";
import { EXPENSE_CATEGORIES, EXPENSE_LABELS } from "@/lib/expenses";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

const SELECT_CLASS =
  "h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createExpenseAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <p className="font-bold">Novo gasto</p>

      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Gasto lançado!</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="spentOn" type="date" required defaultValue={today} />
        </Field>
        <Field label="Categoria">
          <select name="category" required defaultValue="mercadoria" className={SELECT_CLASS}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição" hint="Ex.: Compra Brás — bodies, Internet, Meta Ads.">
          <Input name="description" required maxLength={160} placeholder="O que foi?" />
        </Field>
        <Field label="Valor (R$)">
          <Input name="amount" inputMode="decimal" required placeholder="0,00" />
        </Field>
        <Field label="Fornecedor" hint="Opcional.">
          <Input name="supplier" maxLength={120} />
        </Field>
        <Field label="Observação" hint="Opcional.">
          <Input name="notes" maxLength={500} />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : "Lançar gasto"}
      </Button>
    </form>
  );
}
