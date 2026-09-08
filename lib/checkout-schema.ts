import { z } from "zod";

export const addressSchema = z.object({
  recipient: z.string().min(2, "Informe o nome de quem recebe"),
  cep: z.string().min(8),
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional().nullable(),
  district: z.string().min(1),
  city: z.string().min(2),
  state: z.string().length(2),
});

export const checkoutCreateSchema = z.object({
  email: z.string().email("E-mail inválido"),
  address: addressSchema,
  shipping: z.object({
    company: z.string(),
    service: z.string(),
    price: z.number().nonnegative(),
  }),
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1, "Carrinho vazio"),
});

export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
