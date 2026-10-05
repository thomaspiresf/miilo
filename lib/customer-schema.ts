import { z } from "zod";

const emptyToNull = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" || s == null ? null : s;
};

/** Dados de contato do cliente editados no admin (valem pra um ou vários pedidos). */
export const customerContactSchema = z.object({
  name: z.preprocess(emptyToNull, z.string().max(120, "Nome muito longo").nullable()),
  // salvo só com dígitos e sem o 55, como nos pedidos
  phone: z.preprocess(
    (v) => {
      const d = typeof v === "string" ? v.replace(/\D/g, "") : "";
      if (!d) return null;
      return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
    },
    z.string().regex(/^\d{10,11}$/, "Telefone inválido — use DDD + número").nullable(),
  ),
  email: z.preprocess(
    (v) => {
      const s = emptyToNull(v);
      return typeof s === "string" ? s.toLowerCase() : s;
    },
    z.string().email("E-mail inválido").max(160).nullable(),
  ),
});

export type CustomerContact = z.infer<typeof customerContactSchema>;
