"use client";

import { useActionState } from "react";
import { createCategoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function CategoryForm() {
  const [state, action, pending] = useActionState(createCategoryAction, null);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <p className="font-bold">Nova categoria</p>
      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Criada!</p>
      )}
      <Field label="Nome">
        <Input name="name" required />
      </Field>
      <Field label="Tipo">
        <select
          name="kind"
          className="h-11 w-full rounded-xl border border-border bg-surface px-3"
        >
          <option value="roupas">roupas</option>
          <option value="brinquedos">brinquedos</option>
          <option value="livros">livros</option>
        </select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : "Criar"}
      </Button>
    </form>
  );
}
