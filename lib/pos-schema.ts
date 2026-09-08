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
  /** dinheiro/maquininha (já pago) · link para o cliente · pagar agora na tela */
  payMode: z.enum(["cash", "link", "now"]),
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
