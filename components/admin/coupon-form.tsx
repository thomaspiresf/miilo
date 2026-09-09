"use client";

import { useActionState } from "react";
import { createCouponAction } from "@/app/admin/cupons/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function CouponForm() {
  const [state, action, pending] = useActionState(createCouponAction, null);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <p className="font-bold">Novo cupom</p>

      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Cupom criado!</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" hint="Letras, números e hífen. Vira maiúsculo.">
          <Input name="code" required placeholder="BEMVINDO10" autoCapitalize="characters" />
        </Field>
        <Field label="Desconto (%)" hint="Percentual sobre o subtotal.">
          <Input name="percentOff" inputMode="decimal" required placeholder="10" />
        </Field>
        <Field label="Compra mínima (R$)" hint="Opcional. Vazio = sem mínimo.">
          <Input name="minSubtotal" inputMode="decimal" placeholder="150" />
        </Field>
        <Field label="Limite de usos" hint="Opcional. Conta quando o pedido é pago.">
          <Input name="maxUses" inputMode="numeric" placeholder="50" />
        </Field>
        <Field label="Validade" hint="Opcional. Funciona até o fim desse dia.">
          <Input name="expiresAt" type="date" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked className="accent-primary" />
        Ativo (já pode ser usado no checkout)
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : "Criar cupom"}
      </Button>
    </form>
  );
}
