import { z } from "zod";
import { EXPENSE_CATEGORIES, EXPENSE_ITEM_TYPES, EXPENSE_PAYERS } from "@/lib/expenses";
import { parseMoney } from "@/lib/format";

const emptyToNull = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" || s == null ? null : String(s);
};

export const expenseInputSchema = z.object({
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Escolha uma categoria" }),
  payer: z.enum(EXPENSE_PAYERS, { message: "Diga quem pagou" }),
  itemType: z.preprocess(emptyToNull, z.enum(EXPENSE_ITEM_TYPES, { message: "Tipo inválido" }).nullable()),
  description: z.string().trim().min(2, "Descreva o gasto").max(160, "Descrição muito longa"),
  amount: z.string().transform((s, ctx) => {
    const v = parseMoney(s);
    if (v == null || v <= 0) {
      ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero" });
      return z.NEVER;
    }
    return v;
  }),
  supplier: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  notes: z.preprocess(emptyToNull, z.string().max(500).nullable()),
  /** caminho no bucket expense-receipts — só aceita o formato gerado pelo upload */
  receiptPath: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^receipts\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Anexo inválido")
      .nullable(),
  ),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
