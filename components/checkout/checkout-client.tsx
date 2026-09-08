"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Store } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { formatBRL, formatCep } from "@/lib/format";
import { onlyDigits } from "@/lib/utils";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Address, DeliveryMode, ShippingOption } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner, EmptyState } from "@/components/ui/misc";
import { MockPayment } from "@/components/checkout/mock-payment";
import { PaymentBrick } from "@/components/checkout/payment-brick";

type FormState = {
  email: string;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const EMPTY: FormState = {
  email: "",
  name: "",
  phone: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function CheckoutClient({
  initialEmail,
  savedAddress,
  paymentsMocked,
}: {
  initialEmail: string;
  savedAddress: Address | null;
  paymentsMocked: boolean;
}) {
  const router = useRouter();
  const mounted = useHydrated();

  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const [mode, setMode] = useState<DeliveryMode>("delivery");
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    email: initialEmail,
    ...(savedAddress
      ? {
          name: savedAddress.recipient,
          cep: savedAddress.cep,
          street: savedAddress.street,
          number: savedAddress.number,
          complement: savedAddress.complement ?? "",
          district: savedAddress.district,
          city: savedAddress.city,
          state: savedAddress.state,
        }
      : {}),
  });
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [cepLoading, setCepLoading] = useState(false);
  const [shipping, setShipping] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  const [phase, setPhase] = useState<"form" | "payment">("form");
  const [order, setOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);

  const locked = phase === "payment";
  const cepDigits = onlyDigits(form.cep);
  const phoneDigits = onlyDigits(form.phone);
  const canQuote = cepDigits.length === 8 && lines.length > 0;

  const shippingCost = mode === "pickup" ? 0 : (selectedShipping?.price ?? 0);
  const total = subtotal + shippingCost;

  const contactOk = form.email && form.name.trim().length >= 3;
  const addressOk =
    cepDigits.length === 8 &&
    form.street &&
    form.number &&
    form.district &&
    form.city &&
    form.state;
  const readyForPayment =
    contactOk &&
    (mode === "pickup"
      ? phoneDigits.length >= 10
      : addressOk && !!selectedShipping);

  async function lookupCep(cep: string) {
    const d = onlyDigits(cep);
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          district: data.bairro || f.district,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      /* ignora — usuário preenche na mão */
    } finally {
      setCepLoading(false);
    }
  }

  async function quote() {
    if (!canQuote) return;
    setShippingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: cepDigits,
          items: lines.map((l) => ({
            qty: l.qty,
            weightGrams: l.weightGrams,
            unitPrice: l.unitPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no cálculo do frete");
      setShipping(data.options);
      setSelectedShipping(data.options[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no frete");
    } finally {
      setShippingLoading(false);
    }
  }

  async function goToPayment() {
    if (!readyForPayment) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name.trim(),
          phone: phoneDigits || null,
          deliveryMode: mode,
          address:
            mode === "delivery"
              ? {
                  cep: cepDigits,
                  street: form.street,
                  number: form.number,
                  complement: form.complement || null,
                  district: form.district,
                  city: form.city,
                  state: form.state.toUpperCase(),
                }
              : null,
          shipping:
            mode === "delivery" && selectedShipping
              ? {
                  company: selectedShipping.company,
                  service: selectedShipping.service,
                  price: selectedShipping.price,
                }
              : { company: "", service: "Retirada na loja", price: 0 },
          lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar pedido");
      setOrder({ orderId: data.orderId, amount: data.amount });
      setPhase("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  async function processPayment(formData: Record<string, unknown>) {
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pagamento recusado");

      if (data.status === "approved" || data.pix || data.status === "pending") {
        if (data.pix) setPix(data.pix);
        clear();
        router.push(`/pedido/${order.orderId}`);
      } else if (data.status === "rejected") {
        setError("Pagamento recusado. Tente outro método ou cartão.");
      } else {
        clear();
        router.push(`/pedido/${order.orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(
    () => (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-black">Resumo</h2>
        <ul className="mt-3 space-y-3">
          {lines.map((l) => (
            <li key={l.variantId} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
                {l.imageUrl && (
                  <Image src={l.imageUrl} alt={l.name} fill className="object-cover" sizes="56px" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-1 font-semibold">{l.name}</p>
                <p className="text-xs text-muted">
                  {l.variantLabel} · {l.qty}x
                </p>
              </div>
              <span className="text-sm font-semibold">{formatBRL(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{mode === "pickup" ? "Retirada" : "Frete"}</span>
            <span>
              {mode === "pickup"
                ? "Grátis"
                : selectedShipping
                  ? selectedShipping.price === 0
                    ? "Grátis"
                    : formatBRL(selectedShipping.price)
                  : "—"}
            </span>
          </div>
          <div className="flex justify-between pt-2 text-base font-black">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      </div>
    ),
    [lines, subtotal, selectedShipping, total, mode],
  );

  if (!mounted) return null;

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Sacola vazia"
        description="Adicione produtos antes de finalizar a compra."
        action={
          <Button asChild>
            <Link href="/c/roupas">Ver produtos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}

        {/* Modo de entrega */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 font-black">1. Como você quer receber</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { id: "delivery", label: "Receber em casa", icon: Home, sub: "Entrega pelos Correios" },
                { id: "pickup", label: "Retirar na loja", icon: Store, sub: "Sem frete · retirada em Laranjal Paulista/SP" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={locked}
                onClick={() => setMode(opt.id)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition disabled:opacity-60",
                  mode === opt.id
                    ? "border-foreground bg-foreground/[0.04]"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-xs text-muted">{opt.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-black">2. Seus dados</h2>
          <div className="space-y-4">
            <Field label="Nome completo">
              <Input
                value={form.name}
                disabled={locked}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Como está no seu documento"
              />
            </Field>
            <Field label="E-mail" hint="Enviaremos a confirmação do pedido aqui.">
              <Input
                type="email"
                inputMode="email"
                value={form.email}
                disabled={locked}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="voce@email.com"
              />
            </Field>
            <Field
              label={mode === "pickup" ? "WhatsApp" : "Telefone (opcional)"}
              hint={mode === "pickup" ? "Vamos combinar a retirada por aqui." : undefined}
            >
              <Input
                inputMode="numeric"
                value={formatPhone(form.phone)}
                disabled={locked}
                onChange={(e) => set("phone")(onlyDigits(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>
        </section>

        {mode === "delivery" ? (
          <>
            {/* Endereço */}
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-4 font-black">3. Endereço de entrega</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CEP">
                    <div className="relative">
                      <Input
                        inputMode="numeric"
                        value={formatCep(form.cep)}
                        disabled={locked}
                        onChange={(e) => set("cep")(onlyDigits(e.target.value))}
                        onBlur={(e) => lookupCep(e.target.value)}
                        placeholder="00000-000"
                      />
                      {cepLoading && (
                        <Spinner className="absolute right-3 top-3.5 text-muted" />
                      )}
                    </div>
                  </Field>
                  <Field label="Número">
                    <Input
                      value={form.number}
                      disabled={locked}
                      onChange={(e) => set("number")(e.target.value)}
                      placeholder="123"
                    />
                  </Field>
                </div>
                <Field label="Rua">
                  <Input value={form.street} disabled={locked} onChange={(e) => set("street")(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bairro">
                    <Input value={form.district} disabled={locked} onChange={(e) => set("district")(e.target.value)} />
                  </Field>
                  <Field label="Complemento">
                    <Input
                      value={form.complement}
                      disabled={locked}
                      onChange={(e) => set("complement")(e.target.value)}
                      placeholder="Apto, bloco…"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <Field label="Cidade">
                    <Input value={form.city} disabled={locked} onChange={(e) => set("city")(e.target.value)} />
                  </Field>
                  <Field label="UF">
                    <Input
                      value={form.state}
                      maxLength={2}
                      disabled={locked}
                      onChange={(e) => set("state")(e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Frete */}
            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black">4. Frete</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={quote}
                  disabled={!canQuote || shippingLoading || locked}
                >
                  {shippingLoading ? <Spinner /> : "Calcular frete"}
                </Button>
              </div>
              {shipping.length === 0 ? (
                <p className="text-sm text-muted">Informe o CEP e clique em “Calcular frete”.</p>
              ) : (
                <div className="space-y-2">
                  {shipping.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                        selectedShipping?.id === opt.id ? "border-primary bg-primary/5" : "border-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShipping?.id === opt.id}
                        disabled={locked}
                        onChange={() => setSelectedShipping(opt)}
                        className="accent-primary"
                      />
                      <span className="flex-1 text-sm">
                        <span className="block font-semibold">
                          {opt.company} {opt.service}
                        </span>
                        <span className="block text-xs text-muted">
                          {opt.delivery_days > 0 ? `até ${opt.delivery_days} dias úteis` : "prazo a confirmar"}
                        </span>
                      </span>
                      <span className="text-sm font-bold">
                        {opt.price === 0 ? "Grátis" : formatBRL(opt.price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-black">3. Retirada na loja</h2>
            <div className="flex items-start gap-3 rounded-xl bg-accent/10 px-4 py-3">
              <Store className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="text-sm">
                <p className="font-bold">{site.storeAddress}</p>
                <p className="mt-1 text-muted">{site.pickupNote}</p>
              </div>
            </div>
          </section>
        )}

        {/* Pagamento */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-black">{mode === "delivery" ? "5" : "4"}. Pagamento</h2>
          {phase === "form" ? (
            <Button
              size="lg"
              className="w-full"
              onClick={goToPayment}
              disabled={!readyForPayment || submitting}
            >
              {submitting ? <Spinner /> : `Continuar para pagamento · ${formatBRL(total)}`}
            </Button>
          ) : order ? (
            !paymentsMocked && site.mpPublicKey ? (
              <PaymentBrick
                amount={order.amount}
                email={form.email}
                onSubmit={({ formData }) => processPayment(formData)}
                onError={(err) => {
                  console.error(err);
                  setError("Erro ao carregar o pagamento.");
                }}
              />
            ) : (
              <MockPayment
                amount={order.amount}
                submitting={submitting}
                onSubmit={(fd) => processPayment(fd)}
              />
            )
          ) : null}
          {pix && (
            <p className="mt-3 text-sm text-muted">
              Pix gerado — você será levado para a página do pedido.
            </p>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 lg:h-fit">{summary}</aside>
    </div>
  );
}
