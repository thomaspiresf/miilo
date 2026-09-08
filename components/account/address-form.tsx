"use client";

import { useActionState, useState } from "react";
import { saveAddress } from "@/app/(loja)/conta/enderecos/actions";
import { formatCep } from "@/lib/format";
import { onlyDigits } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function AddressForm() {
  const [state, action, pending] = useActionState(saveAddress, null);
  const [cep, setCep] = useState("");
  const [auto, setAuto] = useState({ street: "", district: "", city: "", state: "" });

  async function lookup(v: string) {
    const d = onlyDigits(v);
    if (d.length !== 8) return;
    try {
      const data = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((r) => r.json());
      if (!data.erro)
        setAuto({
          street: data.logradouro ?? "",
          district: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        });
    } catch {
      /* noop */
    }
  }

  if (state?.ok) {
    return (
      <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
        Endereço salvo. <a href="/conta/enderecos" className="underline">Atualizar lista</a>
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <p className="font-bold">Novo endereço</p>
      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      <Field label="Quem recebe">
        <Input name="recipient" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CEP">
          <Input
            name="cep"
            required
            inputMode="numeric"
            value={formatCep(cep)}
            onChange={(e) => setCep(onlyDigits(e.target.value))}
            onBlur={(e) => lookup(e.target.value)}
          />
        </Field>
        <Field label="Número">
          <Input name="number" required />
        </Field>
      </div>
      <Field label="Rua">
        <Input name="street" required defaultValue={auto.street} key={auto.street} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bairro">
          <Input name="district" required defaultValue={auto.district} key={auto.district} />
        </Field>
        <Field label="Complemento">
          <Input name="complement" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Field label="Cidade">
          <Input name="city" required defaultValue={auto.city} key={auto.city} />
        </Field>
        <Field label="UF">
          <Input name="state" required maxLength={2} defaultValue={auto.state} key={auto.state} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default" className="accent-primary" />
        Usar como endereço padrão
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : "Salvar endereço"}
      </Button>
    </form>
  );
}
