import Link from "next/link";
import { Search, X } from "lucide-react";
import { listAllOrders } from "@/lib/data/orders";
import { formatBRL } from "@/lib/format";
import { OrderList, type OrderListItem } from "@/components/admin/order-list";
import { CustomerList } from "@/components/admin/customer-list";
import { customerMatches, groupOrdersByCustomer } from "@/lib/customers";
import { chargeMessageText } from "@/lib/whatsapp";
import { isReceivable } from "@/lib/receivables";
import { site } from "@/lib/site";
import type { Order, OrderStatus } from "@/lib/types";
import { amountDue, isOverdue } from "@/lib/order-utils";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "receber", label: "A receber (loja)" },
  { value: "pending", label: "Aguardando" },
  { value: "paid", label: "Pagos" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "failed", label: "Falhos" },
];

const toItem = (o: Order): OrderListItem => ({
  id: o.id,
  number: o.number,
  email: o.email,
  customerName: o.customer_name,
  created_at: o.created_at,
  status: o.status,
  total: o.total,
  channel: o.channel,
  paymentMethod: o.payment_method,
  posPayMode: o.pos_pay_mode,
  phone: o.phone,
  ...(isReceivable(o)
    ? { overdue: isOverdue(o.created_at), chargeMessage: chargeMessageText(o, `${site.url}/pagar/${o.id}`) }
    : {}),
  items: o.items.map((it) => ({
    name: it.product_name,
    qty: it.qty,
    total: it.unit_price * it.qty,
  })),
});

export default async function AdminOrdersPage(props: PageProps<"/admin/pedidos">) {
  const sp = await props.searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "";
  const receberView = raw === "receber";
  const status = (receberView ? "" : raw) as OrderStatus | "";

  const all = await listAllOrders();
  const receivables = all.filter(isReceivable);
  const receivableTotal = receivables.reduce((s, o) => s + amountDue(o), 0);

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const byCustomer = sp.vista === "clientes";

  const scoped = receberView
    ? receivables
    : status
      ? all.filter((o) => o.status === status)
      : all;

  // agrupa por cliente e filtra pela busca (nome, telefone, e-mail ou nº do pedido)
  const groups = groupOrdersByCustomer(scoped).filter((g) => customerMatches(g, q));
  const orders = groups
    .flatMap((g) => g.orders)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // links dos filtros mantêm a busca e a vista
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (byCustomer) p.set("vista", "clientes");
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    return `/admin/pedidos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Pedidos</h1>

      {receivables.length > 0 && !receberView && (
        <Link prefetch={false}
          href="/admin/pedidos?status=receber"
          className="block rounded-xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning hover:bg-warning/15"
        >
          A receber: {formatBRL(receivableTotal)} em{" "}
          {receivables.length === 1 ? "1 venda" : `${receivables.length} vendas`} da
          loja — ver →
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" action="/admin/pedidos" className="relative min-w-0 flex-1 basis-64">
          {raw && <input type="hidden" name="status" value={raw} />}
          {byCustomer && <input type="hidden" name="vista" value="clientes" />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por cliente, telefone, e-mail ou nº do pedido"
            aria-label="Buscar pedidos"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-sm outline-none focus:border-primary"
          />
          {q && (
            <Link
              prefetch={false}
              href={keep({ q: "" })}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-black/5"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          )}
        </form>
        <div role="tablist" aria-label="Vista" className="inline-flex shrink-0 rounded-full border border-border bg-black/[0.03] p-0.5 text-sm">
          {[
            { id: false, label: "Pedidos", href: keep({ vista: "" }) },
            { id: true, label: "Por cliente", href: keep({ vista: "clientes" }) },
          ].map((v) => (
            <Link
              prefetch={false}
              key={v.label}
              href={v.href}
              role="tab"
              aria-selected={byCustomer === v.id}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition ${
                byCustomer === v.id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link prefetch={false}
            key={f.value}
            href={keep({ status: f.value })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              raw === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {receberView && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Total a receber</span>
          <span className="flex items-center gap-3">
            <Link prefetch={false} href="/admin/conversas?aba=cobrancas" className="text-xs font-semibold text-primary hover:underline">
              Abrir painel de cobranças →
            </Link>
            <span className="font-black">{formatBRL(receivableTotal)}</span>
          </span>
        </div>
      )}

      {q && (
        <p className="text-xs text-muted">
          {byCustomer
            ? `${groups.length} cliente${groups.length === 1 ? "" : "s"}`
            : `${orders.length} pedido${orders.length === 1 ? "" : "s"}`}{" "}
          para “{q}”
        </p>
      )}

      {byCustomer ? (
        <CustomerList
          customers={groups.map((g) => ({
            key: g.key,
            name: g.name,
            phones: g.phones,
            emails: g.emails,
            anonymous: g.anonymous,
            lastAt: g.lastAt,
            received: g.received,
            due: g.due,
            orders: g.orders.map(toItem),
          }))}
          empty={q ? "Nenhum cliente encontrado." : "Nenhum cliente."}
        />
      ) : (
        <OrderList orders={orders.map(toItem)} empty={q ? "Nenhum pedido encontrado." : "Nenhum pedido."} />
      )}
    </div>
  );
}
