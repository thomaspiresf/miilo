import { Megaphone, MessageCircle, Package, Puzzle, Receipt, ShoppingBag, Shirt, Sparkles, Tag, type LucideIcon } from "lucide-react";
import type { Expense } from "@/lib/expenses";
import { cn } from "@/lib/utils";

const BY_CATEGORY: Record<Expense["category"], LucideIcon> = {
  mercadoria: ShoppingBag,
  fixa: Receipt,
  marketing: Megaphone,
  outros: Tag,
};

const BY_ITEM_TYPE: Partial<Record<NonNullable<Expense["item_type"]>, LucideIcon>> = {
  brinquedo: Puzzle,
  roupa: Shirt,
  sacolas: Package,
};

const BY_SOURCE: Record<string, LucideIcon> = {
  meta_whatsapp: MessageCircle,
  meta_ads: Megaphone,
  anthropic: Sparkles,
};

/** Ícone discreto do investimento (círculo cinza, traço preto): origem automática > tipo > categoria. */
export function ExpenseIcon({ expense, className }: { expense: Pick<Expense, "category" | "item_type" | "source">; className?: string }) {
  const Icon =
    (expense.source ? BY_SOURCE[expense.source] : undefined) ??
    (expense.item_type ? BY_ITEM_TYPE[expense.item_type] : undefined) ??
    BY_CATEGORY[expense.category];
  return (
    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[0.05] text-foreground", className)} aria-hidden>
      <Icon className="h-5 w-5" strokeWidth={1.6} />
    </span>
  );
}
