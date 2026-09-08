const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um valor em reais. Aceita number (reais) — ex: 79.9 -> "R$ 79,90". */
export function formatBRL(value: number | null | undefined) {
  return BRL.format(Number(value ?? 0));
}

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return DATE.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return DATETIME.format(new Date(value));
}

/**
 * Parcelamento sem juros. Ex.: installment(199.99, 3) -> "3x de R$ 66,66 sem juros".
 * Só mostra parcela se o valor da parcela ficar >= R$ 15 (evita "10x de R$ 3").
 */
export function installmentText(
  price: number,
  maxInstallments = 3,
  minPerInstallment = 15,
) {
  if (!price || maxInstallments <= 1) return null;
  let n = maxInstallments;
  while (n > 1 && price / n < minPerInstallment) n--;
  if (n <= 1) return null;
  return `${n}x de ${formatBRL(price / n)} sem juros`;
}

export function discountPercent(price: number, compareAt: number | null | undefined) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round((1 - price / compareAt) * 100);
}

export function formatCep(cep: string) {
  const d = (cep || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Faixa etária em meses -> texto amigável ("0–3 meses", "2–4 anos"). */
export function formatAgeRange(
  minMonths: number | null | undefined,
  maxMonths: number | null | undefined,
) {
  if (minMonths == null && maxMonths == null) return null;
  if ((minMonths ?? 0) === 0 && maxMonths == null) return null;

  const single = (m: number) =>
    m < 24 ? `${m} ${m === 1 ? "mês" : "meses"}` : `${Math.round(m / 12)} anos`;

  if (minMonths != null && maxMonths != null) {
    // usa a mesma unidade nas duas pontas, definida pelo limite superior
    if (maxMonths < 24) return `${minMonths}–${maxMonths} meses`;
    const minY = Math.max(1, Math.round(minMonths / 12));
    const maxY = Math.round(maxMonths / 12);
    return minMonths < 12 ? `${minMonths} meses – ${maxY} anos` : `${minY}–${maxY} anos`;
  }
  if (minMonths != null) return `a partir de ${single(minMonths)}`;
  return `até ${single(maxMonths as number)}`;
}
