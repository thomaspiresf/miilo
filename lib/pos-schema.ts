import { z } from "zod";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Venda presencial criada no /admin/pdv. */
export const posOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => {
      const d = v ? onlyDigits(v) : "";
      return d.length >= 10 ? d : null;
    }),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "E-mail inválido",
    }),
  /**
   * link para o cliente · pagar agora na tela · dinheiro/maquininha (já pago) ·
   * anotar como "a receber" (cliente paga depois)
   */
  payMode: z.enum(["link", "now", "cash", "later"]),
  /** desconto em reais aplicado na venda (o servidor limita ao subtotal) */
  discount: z.number().nonnegative().optional().default(0),
  /** observação livre do vendedor (ex.: "paga dia 15") */
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1, "Adicione ao menos um produto"),
});

export type PosOrderInput = z.infer<typeof posOrderSchema>;
