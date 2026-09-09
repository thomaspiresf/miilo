import { z } from "zod";

/** Endereço salvo na conta (tem "quem recebe" próprio). */
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

/** Endereço de entrega no checkout (o nome do cliente é campo separado). */
export const shippingAddressSchema = z.object({
  cep: z.string().min(8),
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional().nullable(),
  district: z.string().min(1),
  city: z.string().min(2),
  state: z.string().length(2),
});

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const checkoutCreateSchema = z
  .object({
    email: z.string().email("E-mail inválido"),
    name: z.string().trim().min(3, "Informe o nome completo"),
    phone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    deliveryMode: z.enum(["delivery", "pickup"]),
    couponCode: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    address: shippingAddressSchema.nullable().optional(),
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
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "delivery") {
      if (!data.address) {
        ctx.addIssue({ code: "custom", message: "Endereço obrigatório para entrega", path: ["address"] });
      }
    }
    if (data.deliveryMode === "pickup") {
      if (!data.phone || onlyDigits(data.phone).length < 10) {
        ctx.addIssue({ code: "custom", message: "Telefone obrigatório para retirada", path: ["phone"] });
      }
    }
  });

export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
