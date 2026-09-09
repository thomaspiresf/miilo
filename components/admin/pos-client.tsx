"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Banknote,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Link2,
  Minus,
  Plus,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { formatBRL, parseMoney } from "@/lib/format";
import { onlyDigits, cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { createPosOrder } from "@/app/admin/pdv/actions";

export type PosProduct = {
  id: string;
  name: string;
  image: string | null;
  kind: "roupas" | "brinquedos" | "livros";
  variants: { id: string; label: string; price: number; stock: number }[];
};

type KindFilter = "all" | "roupas" | "brinquedos" | "livros";

const KIND_TABS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "roupas", label: "Roupas" },
  { id: "brinquedos", label: "Brinquedos" },
  { id: "livros", label: "Livros" },
];

type RecentSale = {
  id: string;
  number: string;
  total: number;
  status: OrderStatus;
  customer: string | null;
  createdAt: string;
};

type CartLine = {
  variantId: string;
  name: string;
  label: string;
  image: string | null;
  price: number;
  stock: number;
  qty: number;
};

type PayMode = "cash" | "link" | "now";

type Created = {
  orderId: string;
  orderNumber: string;
  total: number;
  paid: boolean;
  payUrl: string | null;
  mode: PayMode;
};

const PAY_MODES: {
  id: PayMode;
  label: string;
  sub: string;
  icon: typeof Banknote;
}[] = [
  { id: "cash", label: "Dinheiro / maquininha", sub: "Já recebido — registra e baixa o estoque", icon: Banknote },
  { id: "link", label: "Enviar link ao cliente", sub: "Pix ou cartão — manda por WhatsApp", icon: Link2 },
  { id: "now", label: "Pagar agora na tela", sub: "Abre o Pix / cartão neste aparelho", icon: CreditCard },
];

export function PosClient({
  catalog,
  recent,
}: {
  catalog: PosProduct[];
  recent: RecentSale[];
}) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("cash");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = Math.min(Math.max(0, parseMoney(discountInput) ?? 0), subtotal);
  const total = subtotal - discount;
  const phoneDigits = onlyDigits(phone);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = catalog.filter(
      (p) => kindFilter === "all" || p.kind === kindFilter,
    );
    const matched = q ? base.filter((p) => p.name.toLowerCase().includes(q)) : base;
    return matched.slice(0, q ? 12 : 8);
  }, [catalog, query, kindFilter]);

  function addVariant(p: PosProduct, v: PosProduct["variants"][number]) {
    setError(null);
    setCart((cur) => {
      const found = cur.find((l) => l.variantId === v.id);
      if (found) {
        if (found.qty >= v.stock) return cur;
        return cur.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (v.stock < 1) return cur;
      return [
        ...cur,
        {
          variantId: v.id,
          name: p.name,
          label: v.label,
          image: p.image,
          price: v.price,
          stock: v.stock,
          qty: 1,
        },
      ];
    });
  }

  function setQty(variantId: string, qty: number) {
    setCart((cur) =>
      cur
        .map((l) =>
          l.variantId === variantId ? { ...l, qty: Math.min(l.stock, Math.max(0, qty)) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  async function submit() {
    if (cart.length === 0) {
      setError("Adicione ao menos um produto.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createPosOrder({
        customerName: customerName.trim() || null,
        phone: phoneDigits || null,
        email: email.trim() || null,
        payMode,
        discount,
        lines: cart.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setCreated({
        orderId: res.orderId,
        orderNumber: res.orderNumber,
        total: res.total,
        paid: res.paid,
        payUrl: res.payUrl,
        mode: payMode,
      });
    } catch {
      setError("Não foi possível registrar a venda. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  function newSale() {
    setCreated(null);
    setCart([]);
    setCustomerName("");
    setPhone("");
    setEmail("");
    setDiscountInput("");
    setPayMode("cash");
    setQuery("");
    setError(null);
  }

  if (created) {
    return <SaleResult created={created} phoneDigits={phoneDigits} onNewSale={newSale} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Venda na loja</h1>
        <p className="text-sm text-muted">
          Monte a venda, baixe do estoque e receba em dinheiro ou por link de pagamento.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Buscar produto */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-black">1. Produtos</h2>

            <div className="mb-3 flex gap-1.5">
              {KIND_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setKindFilter(t.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    kindFilter === t.id
                      ? "bg-foreground text-background"
                      : "border border-border bg-surface hover:bg-black/5",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome…"
                className="h-11 w-full bg-transparent px-2 text-sm outline-none"
              />
            </div>

            <div className="mt-3 space-y-2">
              {results.length === 0 && (
                <p className="py-4 text-center text-sm text-muted">Nenhum produto encontrado.</p>
              )}
              {results.map((p) => (
                <div key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5">
                      {p.image && (
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <p className="text-sm font-semibold">{p.name}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.variants.map((v) => {
                      const inCart = cart.find((l) => l.variantId === v.id)?.qty ?? 0;
                      const full = inCart >= v.stock || v.stock < 1;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => addVariant(p, v)}
                          disabled={full}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-left text-xs transition disabled:opacity-40",
                            inCart > 0 ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
                          )}
                        >
                          <span className="block font-semibold">{v.label}</span>
                          <span className="block text-muted">
                            {formatBRL(v.price)} · {v.stock} em estoque
                            {inCart > 0 ? ` · ${inCart} na venda` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Carrinho */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-black">2. Itens da venda</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-muted">Nenhum item ainda.</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((l) => (
                  <li key={l.variantId} className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/5">
                      {l.image && (
                        <Image
                          src={l.image}
                          alt={l.name}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="text-xs text-muted">
                        {l.label} · {formatBRL(l.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQty(l.variantId, l.qty - 1)}
                        className="rounded-lg border border-border p-1.5 hover:bg-black/5"
                        aria-label="Menos"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(l.variantId, l.qty + 1)}
                        disabled={l.qty >= l.stock}
                        className="rounded-lg border border-border p-1.5 hover:bg-black/5 disabled:opacity-40"
                        aria-label="Mais"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-bold">
                      {formatBRL(l.price * l.qty)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(l.variantId, 0)}
                      className="rounded-lg p-1.5 text-muted hover:bg-black/5 hover:text-danger"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cliente */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 font-black">3. Cliente (opcional)</h2>
            <p className="mb-4 text-xs text-muted">
              Preencha o WhatsApp para mandar o link de pagamento por lá. O e-mail recebe a
              confirmação do pedido.
            </p>
            <div className="space-y-4">
              <Field label="Nome">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="WhatsApp">
                  <Input
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(onlyDigits(e.target.value))}
                    placeholder="(11) 99999-9999"
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Recebimento */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-black">4. Como vai receber</h2>
            <div className="space-y-2">
              {PAY_MODES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPayMode(opt.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    payMode === opt.id
                      ? "border-foreground bg-foreground/[0.04]"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <opt.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{opt.label}</span>
                    <span className="block text-xs text-muted">{opt.sub}</span>
                  </span>
                  <span
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-full border-2",
                      payMode === opt.id ? "border-foreground bg-foreground" : "border-border",
                    )}
                  />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Resumo */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-black">Resumo</h2>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">
                {cart.reduce((n, l) => n + l.qty, 0)} {cart.reduce((n, l) => n + l.qty, 0) === 1 ? "item" : "itens"}
              </span>
              <span>{formatBRL(subtotal)}</span>
            </div>

            <div className="mt-2">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">Desconto R$</span>
                <input
                  inputMode="decimal"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0,00"
                  className="h-9 w-24 rounded-lg border border-border bg-background px-2.5 text-right text-sm outline-none focus:border-primary"
                />
              </label>
              {discount > 0 && (
                <p className="mt-1 text-right text-xs text-success">
                  −{formatBRL(discount)}
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-black">{formatBRL(total)}</span>
            </div>

            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={submit}
              disabled={submitting || cart.length === 0}
            >
              {submitting ? (
                <Spinner />
              ) : payMode === "cash" ? (
                "Registrar venda paga"
              ) : payMode === "link" ? (
                "Gerar link de pagamento"
              ) : (
                "Ir para o pagamento"
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              {payMode === "cash"
                ? "O estoque é baixado na hora."
                : "O estoque é baixado quando o pagamento é confirmado."}
            </p>
          </div>

          {recent.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-2 text-sm font-black">Vendas recentes na loja</h2>
              <ul className="divide-y divide-border text-sm">
                {recent.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/admin/pedidos/${s.id}`}
                      className="flex items-center justify-between gap-2 py-2 hover:opacity-70"
                    >
                      <span className="font-semibold">{s.number}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          s.status === "paid" || s.status === "delivered"
                            ? "bg-success/15 text-success"
                            : s.status === "pending"
                              ? "bg-warning/15 text-warning"
                              : "bg-black/5 text-muted",
                        )}
                      >
                        {ORDER_STATUS[s.status].label}
                      </span>
                      <span className="font-bold">{formatBRL(s.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
//  Tela de resultado (venda criada)
// --------------------------------------------------------------------------
function SaleResult({
  created,
  phoneDigits,
  onNewSale,
}: {
  created: Created;
  phoneDigits: string;
  onNewSale: () => void;
}) {
  const [paid, setPaid] = useState(created.paid);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const payUrl = created.payUrl;

  useEffect(() => {
    if (!payUrl) return;
    QRCode.toDataURL(payUrl, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [payUrl]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${created.orderId}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (["paid", "shipped", "delivered"].includes(data.status)) setPaid(true);
    } catch {
      /* silencioso */
    }
  }, [created.orderId]);

  useEffect(() => {
    if (paid || created.paid) return;
    pollRef.current = setInterval(checkStatus, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paid, created.paid, checkStatus]);

  useEffect(() => {
    if (paid && pollRef.current) clearInterval(pollRef.current);
  }, [paid]);

  function copy() {
    if (!payUrl) return;
    navigator.clipboard?.writeText(payUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  }

  const waText = encodeURIComponent(
    `Olá! Aqui está o link para pagar sua compra na miilo (pedido ${created.orderNumber}): ${payUrl}`,
  );
  const waHref = phoneDigits
    ? `https://wa.me/55${phoneDigits}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div
          className={cn(
            "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
            paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          {paid ? <Check className="h-6 w-6" /> : <QrCode className="h-6 w-6" />}
        </div>
        <h1 className="mt-3 text-xl font-black">
          {paid ? "Pagamento confirmado" : "Venda registrada"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pedido <span className="font-semibold text-foreground">{created.orderNumber}</span> ·{" "}
          {formatBRL(created.total)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {paid
            ? "Estoque baixado. Tudo certo."
            : "O estoque será baixado assim que o cliente pagar."}
        </p>
      </div>

      {!paid && payUrl && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          {created.mode === "now" ? (
            <Button asChild size="lg" className="w-full">
              <a href={payUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-5 w-5" /> Abrir tela de pagamento
              </a>
            </Button>
          ) : (
            <Button asChild size="lg" variant="secondary" className="w-full">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                Enviar pelo WhatsApp
              </a>
            </Button>
          )}

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={payUrl}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-muted"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>

          {qr && (
            <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code do link de pagamento" width={200} height={200} />
              <p className="text-xs text-muted">O cliente aponta a câmera para pagar.</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <Spinner className="h-3.5 w-3.5" /> Aguardando pagamento…
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={onNewSale} className="flex-1">
          Nova venda
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/admin/pedidos/${created.orderId}`}>Ver pedido</Link>
        </Button>
      </div>
    </div>
  );
}
