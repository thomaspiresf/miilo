import { z } from "zod";

/** Normaliza o código do cupom: sem espaços, maiúsculas, sem curingas de LIKE. */
export function normalizeCode(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[%_]/g, "");
}

const emptyToNull = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const couponInputSchema = z.object({
  code: z
    .string()
    .transform(normalizeCode)
    .pipe(z.string().min(3, "Código muito curto").max(24).regex(/^[A-Z0-9-]+$/, "Use só letras, números e hífen")),
  percentOff: z.coerce
    .number()
    .positive("Informe a porcentagem")
    .max(100, "No máximo 100%"),
  minSubtotal: z.preprocess(emptyToNull, z.number().nonnegative().nullable()),
  maxUses: z.preprocess(emptyToNull, z.number().int().positive().nullable()),
  /** "YYYY-MM-DD" ou vazio */
  expiresAt: z.preprocess(
    (v) => (v === "" || v == null ? null : String(v)),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable(),
  ),
  active: z.boolean().default(true),
});

export type CouponInput = z.infer<typeof couponInputSchema>;
