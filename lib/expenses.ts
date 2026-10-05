/** Tipos e utilidades do controle de gastos — sem dependência de servidor (usado também no cliente). */

export const EXPENSE_CATEGORIES = ["mercadoria", "fixa", "marketing", "outros"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  mercadoria: "Compras de mercadoria",
  fixa: "Contas fixas",
  marketing: "Marketing e anúncios",
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
