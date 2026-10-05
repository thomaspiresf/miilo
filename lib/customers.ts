import type { Order } from "@/lib/types";
import { amountDue, receivedSoFar } from "@/lib/order-utils";

/** E-mail genérico das vendas na loja sem cliente — nunca serve pra juntar pedidos. */
const POS_FALLBACK_EMAIL = "venda-loja@miilo.com.br";
const GENERIC_NAMES = new Set(["", "cliente da loja", "cliente"]);

export type CustomerGroup = {
  key: string;
  name: string;
  phones: string[]; // dígitos sem o 55
  emails: string[];
  orders: Order[]; // mais recentes primeiro
  /** pedidos sem telefone, e-mail ou nome — não dá pra saber de quem são */
  anonymous: boolean;
  lastAt: string;
  /** o que já entrou (pago + parte em dinheiro de vendas divididas) */
  received: number;
  /** o que ainda falta receber de vendas na loja pendentes */
  due: number;
};

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Telefone só com dígitos, sem o 55 do país (como fica salvo nos pedidos). */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
}

/**
 * Junta os pedidos por cliente: mesmo telefone OU mesmo e-mail (menos o genérico da loja)
 * = mesma pessoa. Sem nenhum dos dois, junta pelo nome; sem nada, cai em "sem identificação".
 */
export function groupOrdersByCustomer(orders: Order[]): CustomerGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  };

  const keysOf = (o: Order): string[] => {
    const keys: string[] = [];
    const p = phoneKey(o.phone);
    if (p) keys.push(`p:${p}`);
    const e = o.email?.trim().toLowerCase();
    if (e && e !== POS_FALLBACK_EMAIL) keys.push(`e:${e}`);
    if (keys.length === 0) {
      const n = normalizeText(o.customer_name ?? "");
      keys.push(GENERIC_NAMES.has(n) ? "anon" : `n:${n}`);
    }
    return keys;
  };

  for (const o of orders) {
    const ks = keysOf(o);
    ks.forEach((k) => {
      if (!parent.has(k)) parent.set(k, k);
    });
    for (let i = 1; i < ks.length; i++) union(ks[0], ks[i]);
  }

  const buckets = new Map<string, Order[]>();
  for (const o of orders) {
    const root = find(keysOf(o)[0]);
    (buckets.get(root) ?? buckets.set(root, []).get(root)!).push(o);
  }

  const groups: CustomerGroup[] = [];
  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const phones = [...new Set(sorted.map((o) => phoneKey(o.phone)).filter((x): x is string => !!x))];
    const emails = [
      ...new Set(
        sorted
          .map((o) => o.email?.trim().toLowerCase())
          .filter((e): e is string => !!e && e !== POS_FALLBACK_EMAIL),
      ),
    ];
    // nome mais recente que não seja o genérico
    const named = sorted.map((o) => o.customer_name?.trim()).find((n) => n && !GENERIC_NAMES.has(normalizeText(n)));
    const anonymous = key === "anon";
    groups.push({
      key,
      name: anonymous ? "Sem identificação" : (named ?? emails[0] ?? (phones[0] ? `Telefone ${phones[0]}` : "Cliente")),
      phones,
      emails,
      orders: sorted,
      anonymous,
      lastAt: sorted[0].created_at,
      received: sorted.reduce((s, o) => s + receivedSoFar(o), 0),
      due: sorted.filter((o) => o.channel === "pos" && o.status === "pending").reduce((s, o) => s + amountDue(o), 0),
    });
  }
  return groups.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** A busca bate com nome, e-mail, telefone (com ou sem DDD/55) ou número de qualquer pedido do cliente. */
export function customerMatches(g: CustomerGroup, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const text = normalizeText(
    [g.name, ...g.emails, ...g.orders.flatMap((o) => [o.customer_name ?? "", o.email ?? "", o.number])].join(" "),
  );
  if (text.includes(q)) return true;
  return digits.length >= 3 && g.phones.some((p) => p.includes(digits) || `55${p}`.includes(digits));
}
