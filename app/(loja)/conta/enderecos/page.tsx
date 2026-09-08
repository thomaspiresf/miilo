import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, isDemoMode } from "@/lib/auth";
import { listAddresses } from "@/lib/data/addresses";
import { formatCep } from "@/lib/format";
import { AddressForm } from "@/components/account/address-form";
import { deleteAddress, setDefaultAddress } from "./actions";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const demo = await isDemoMode();
  const user = await getUser();
  if (!demo && !user) redirect("/conta/login?next=/conta/enderecos");

  if (demo || !user) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-black">Endereços</h1>
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          Endereços salvos exigem uma conta (Supabase Auth). No modo demonstração
          o endereço é digitado direto no checkout.
        </p>
      </div>
    );
  }

  const addresses = await listAddresses(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-black">Endereços</h1>

      {addresses.length === 0 ? (
        <EmptyState title="Nenhum endereço salvo" />
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">
                    {a.recipient}{" "}
                    {a.is_default && <Badge tone="primary">Padrão</Badge>}
                  </p>
                  <p className="text-muted">
                    {a.street}, {a.number}
                    {a.complement ? ` — ${a.complement}` : ""}
                  </p>
                  <p className="text-muted">
                    {a.district} · {a.city}/{a.state} · {formatCep(a.cep)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs font-semibold">
                {!a.is_default && (
                  <form action={setDefaultAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-primary">Tornar padrão</button>
                  </form>
                )}
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-danger">Remover</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressForm />
    </div>
  );
}
