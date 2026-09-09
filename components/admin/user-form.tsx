"use client";

import { useActionState } from "react";
import { createUserAction } from "@/app/admin/usuarios/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function UserForm() {
  const [state, action, pending] = useActionState(createUserAction, null);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <p className="font-bold">Adicionar conta</p>
      <p className="text-xs text-muted">
        Cria a conta já ativa (com senha). Se quiser que seja admin, o e-mail
        também precisa entrar em <code>ADMIN_EMAILS</code> nas variáveis do site.
      </p>

      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Conta criada!</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail">
          <Input name="email" type="email" required placeholder="pessoa@email.com" />
        </Field>
        <Field label="Nome (opcional)">
          <Input name="name" />
        </Field>
        <Field label="Senha" hint="Mínimo 6 caracteres. Passe pra pessoa depois.">
          <Input name="password" type="text" required minLength={6} />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : "Criar conta"}
      </Button>
    </form>
  );
}
