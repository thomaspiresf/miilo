/** Tipos e utilidades do controle de gastos — sem dependência de servidor (usado também no cliente). */

export const EXPENSE_CATEGORIES = ["mercadoria", "fixa", "marketing", "outros"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  mercadoria: "Compras de mercadoria",
  fixa: "Contas fixas",
  marketing: "Marketing e anúncios",
  outros: "Outros",
};

/** Tipo do que foi comprado (independe da categoria: uma compra de mercadoria pode ser de roupa ou de brinquedo). */
export const EXPENSE_ITEM_TYPES = ["brinquedo", "roupa", "sacolas", "outros"] as const;
export type ExpenseItemType = (typeof EXPENSE_ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ExpenseItemType, string> = {
  brinquedo: "Brinquedo",
  roupa: "Roupa",
  sacolas: "Sacolas",
  outros: "Outros",
};

/** Quem desembolsou o gasto: cada núcleo de sócios ou o caixa da própria Miilo. */
export const EXPENSE_PAYERS = ["thaisa_thomas", "bruna_vinicius", "miilo"] as const;
export type ExpensePayer = (typeof EXPENSE_PAYERS)[number];

export const PAYER_LABELS: Record<ExpensePayer, string> = {
  thaisa_thomas: "Thaisa e Thomás",
  bruna_vinicius: "Bruna e Vinicius",
  miilo: "Miilo (caixa da loja)",
};

/** Os dois núcleos que aportam dinheiro na loja — a Miilo em si não "investe". */
export const INVESTOR_PAYERS = ["thaisa_thomas", "bruna_vinicius"] as const;

export type Expense = {
  id: string;
  spent_on: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  payer: ExpensePayer | null;
  item_type: ExpenseItemType | null;
  supplier: string | null;
  notes: string | null;
  receipt_path: string | null;
  created_by: string | null;
  created_at: string;
};

const BR_TZ = "America/Sao_Paulo";

function brParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Hoje em Brasília, "YYYY-MM-DD". */
export function todayBr(): string {
  const { y, m, d } = brParts(new Date());
  return `${y}-${m}-${d}`;
}

/** Dia ("YYYY-MM-DD") de um instante, em Brasília. */
export function dateKeyBr(iso: string | Date): string {
  const { y, m, d } = brParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${y}-${m}-${d}`;
}

/** Soma `n` dias a uma data "YYYY-MM-DD" (calendário puro, sem fuso). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type PeriodKey = "mes" | "month" | "30" | "90" | "365" | "tudo" | "custom";
/** Período filtrado (datas inclusivas, "YYYY-MM-DD"); from/to nulos = sem limite. */
export type Period = {
  key: PeriodKey;
  from: string | null;
  to: string | null;
  label: string;
  /** "YYYY-MM" quando o período é um mês inteiro (este mês ou um mês escolhido) */
  month?: string;
};

export const PERIOD_CHIPS: { key: "mes" | "30" | "90" | "365" | "tudo"; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "365", label: "12 meses" },
  { key: "tudo", label: "Tudo" },
];

const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const brDay = (d: string) => d.split("-").reverse().join("/");

/** Lê o filtro de período da URL (`periodo`, `de`, `ate`). Padrão: tudo. */
export function resolvePeriod(sp: { periodo?: unknown; de?: unknown; ate?: unknown }): Period {
  const today = todayBr();
  const key = typeof sp.periodo === "string" ? sp.periodo : "tudo";
  const currentYm = today.slice(0, 7);
  const monthPeriod = (ym: string, k: "mes" | "month"): Period => ({
    key: k,
    month: ym,
    from: `${ym}-01`,
    to: addDays(`${shiftMonth(ym, 1)}-01`, -1),
    label: k === "mes" ? "Este mês" : monthLabel(ym).replace(/^./, (c) => c.toUpperCase()),
  });
  if (key === "mes" || key === currentYm) return monthPeriod(currentYm, "mes");
  // um mês específico: ?periodo=2026-09 (não aceita mês futuro)
  if (isMonthKey(key) && key < currentYm) return monthPeriod(key, "month");
  if (key === "30" || key === "90" || key === "365") {
    const days = Number(key);
    const label = key === "365" ? "Últimos 12 meses" : `Últimos ${days} dias`;
    return { key, from: addDays(today, -(days - 1)), to: today, label };
  }
  if (key === "custom" && isDateKey(sp.de) && isDateKey(sp.ate)) {
    const [from, to] = sp.de <= sp.ate ? [sp.de, sp.ate] : [sp.ate, sp.de];
    return { key: "custom", from, to, label: `${brDay(from)} a ${brDay(to)}` };
  }
  return { key: "tudo", from: null, to: null, label: "Todo o período" };
}

export const inPeriod = (date: string, p: Period) =>
  (!p.from || date >= p.from) && (!p.to || date <= p.to);

/** Mês ("YYYY-MM") de um instante, em Brasília. */
export function monthKeyBr(iso: string | Date): string {
  const { y, m } = brParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${y}-${m}`;
}

/** Mês atual em Brasília, "YYYY-MM". */
export function currentMonthBr(): string {
  return todayBr().slice(0, 7);
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** Início (inclusive) e fim (exclusivo) do mês, em horário de Brasília (UTC-3, sem horário de verão). */
export function monthRange(ym: string): { from: Date; to: Date } {
  return {
    from: new Date(`${ym}-01T00:00:00-03:00`),
    to: new Date(`${shiftMonth(ym, 1)}-01T00:00:00-03:00`),
  };
}
