/** Tipos e regras puras do cadastro de produtos por nota (usado no servidor e no cliente). */

export type ScannedItem = {
  name: string;
  quantity: number;
  unitCost: number;
  size: string | null;
  color: string | null;
  /** palpite do tipo de produto; null = não deu pra saber */
  kind: "roupas" | "brinquedos" | "livros" | null;
  code: string | null;
};

export type ProductMatch = {
  productId: string;
  productName: string;
  variantId: string | null;
  score: number;
};

export type ScanItemResult = ScannedItem & {
  /** preço de venda sugerido pela Precificação (null se não deu pra calcular) */
  suggestedPrice: number | null;
  match: ProductMatch | null;
};

export type ScanResponse = {
  items: ScanItemResult[];
  supplier: string | null;
  invoiceDate: string | null;
  /** false quando não há chave da IA configurada — a tela cai pro modo manual */
  aiAvailable: boolean;
  message?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Valida/normaliza o que o modelo devolveu — nunca confia no formato. */
export function sanitizeScan(input: unknown): { items: ScannedItem[]; supplier: string | null; invoiceDate: string | null } | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (r.is_invoice === false) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  const items: ScannedItem[] = [];
  for (const raw of Array.isArray(r.items) ? r.items : []) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const name = str(it.name, 120);
    const quantity = Math.round(Number(it.quantity));
    const unitCost = round2(Number(it.unit_cost));
    if (!name || !Number.isFinite(quantity) || quantity < 1 || quantity > 9999) continue;
    if (!Number.isFinite(unitCost) || unitCost <= 0 || unitCost > 100000) continue;
    const kind = it.kind === "roupas" || it.kind === "brinquedos" || it.kind === "livros" ? it.kind : null;
    items.push({ name, quantity, unitCost, size: str(it.size, 30), color: str(it.color, 40), kind, code: str(it.code, 40) });
    if (items.length >= 80) break;
  }
  const date = typeof r.invoice_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.invoice_date) ? r.invoice_date : null;
  return { items, supplier: str(r.supplier, 120), invoiceDate: date };
}

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "em", "a", "o", "un", "und", "kit", "c", "p"]);

export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP.has(t)),
  );
}

/** Semelhança entre dois nomes (0–1): palavras em comum ÷ palavras do menor nome. */
export function nameScore(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

export type ExistingProduct = { id: string; name: string; variants: { id: string; label: string; size: string | null; stock: number }[] };

/** Procura o produto já cadastrado mais parecido (só aceita semelhança alta). */
export function findMatch(item: ScannedItem, products: ExistingProduct[], threshold = 0.75): ProductMatch | null {
  let best: { p: ExistingProduct; score: number } | null = null;
  for (const p of products) {
    const score = nameScore(item.name, p.name);
    if (score >= threshold && (!best || score > best.score)) best = { p, score };
  }
  if (!best) return null;
  const sized = item.size ? best.p.variants.find((v) => v.size && v.size.toLowerCase() === item.size!.toLowerCase()) : undefined;
  const variantId = sized?.id ?? (best.p.variants.length === 1 ? best.p.variants[0].id : null);
  return { productId: best.p.id, productName: best.p.name, variantId, score: round2(best.score) };
}
