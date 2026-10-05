"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/misc";
import { createCashMovementAction, type CashMovementInput } from "@/app/admin/gastos/cash-actions";
import { ACCOUNT_LABELS, type CashAccount } from "@/lib/cash";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const MODES: { id: CashMovementInput["mode"]; label: string; hint: string }[] = [
  { id: "ajuste", label: "Acertar saldo", hint: "Informe quanto realmente tem na conta agora; o sistema lança a diferença." },
  { id: "entrada", label: "Entrada", hint: "Dinheiro que entrou e não veio de venda (aporte, depósito…)." },
  { id: "saida", label: "Retirada", hint: "Dinheiro que saiu do caixa e não é investimento (retirada de sócio, saque…)." },
  { id: "transferencia", label: "Transferir", hint: "Mover dinheiro entre as duas contas (ex.: depósito do dinheiro no Mercado Pago)." },
];

const SELECT = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-primary";

/** Pop-up "Registrar movimentação": acerto de saldo, entrada, retirada ou transferência. */
export function CashEntryDialog({ today, balances }: { today: string; balances: Record<CashAccount, number> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CashMovementInput["mode"]>("ajuste");
  const [account, setAccount] = useState<CashAccount>("mp");
  const [to, setTo] = useState<CashAccount>("cash");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("ajuste");
    setAccount("mp");
    setTo("cash");
    setAmount("");
    setDate(today);
    setNote("");
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await createCashMovementAction({ mode, account, to: mode === "transferencia" ? to : undefined, amount, date, note });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  const current = MODES.find((m) => m.id === mode)!;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="h-4 w-4" /> Registrar movimentação
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <ModalContent title="Movimentação do caixa" description="Para o saldo bater com a realidade: saldo inicial, retiradas, depósitos e transferências.">
          <div className="space-y-4">
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-black/[0.03] p-1 text-sm sm:grid-cols-4">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  type="button"
                  aria-selected={mode === m.id}
                  onClick={() => {
                    setMode(m.id);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-xl px-2 py-1.5 font-medium transition",
                    mode === m.id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{current.hint}</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={mode === "transferencia" ? "De" : "Conta"}>
                <select value={account} onChange={(e) => setAccount(e.target.value as CashAccount)} className={SELECT}>
                  {(["mp", "cash"] as const).map((a) => (
                    <option key={a} value={a}>
                      {ACCOUNT_LABELS[a]}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "transferencia" ? (
                <Field label="Para">
                  <select value={to} onChange={(e) => setTo(e.target.value as CashAccount)} className={SELECT}>
                    {(["cash", "mp"] as const).map((a) => (
                      <option key={a} value={a}>
                        {ACCOUNT_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Data">
                  <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
                </Field>
              )}
              <Field
                label={mode === "ajuste" ? "Saldo atual na conta (R$)" : "Valor (R$)"}
                hint={mode === "ajuste" ? `Hoje o sistema calcula ${formatBRL(balances[account])} em ${ACCOUNT_LABELS[account]}.` : undefined}
              >
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Observação" hint="Opcional.">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </Field>
            </div>

            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? <Spinner /> : <Plus className="h-4 w-4" />} Registrar
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
