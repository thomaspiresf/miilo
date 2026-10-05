import { Megaphone, MessageCircle, Package, Puzzle, Receipt, ShoppingBag, Shirt, Sparkles, Tag, type LucideIcon } from "lucide-react";
import type { Expense } from "@/lib/expenses";
import { cn } from "@/lib/utils";

type Look = { Icon: LucideIcon; tone: string };

const BY_CATEGORY: Record<Expense["category"], Look> = {
  mercadoria: { Icon: ShoppingBag, tone: "bg-primary/10 text-primary" },
  fixa: { Icon: Receipt, tone: "bg-accent/10 text-accent" },
  marketing: { Icon: Megaphone, tone: "bg-pink/15 text-pink" },
  outros: { Icon: Tag, tone: "bg-black/[0.06] text-muted" },
};

const BY_ITEM_TYPE: Partial<Record<NonNullable<Expense["item_type"]>, Look>> = {
  brinquedo: { Icon: Puzzle, tone: "bg-primary/10 text-primary" },
  roupa: { Icon: Shirt, tone: "bg-accent/10 text-accent" },
  sacolas: { Icon: Package, tone: "bg-warning/15 text-warning" },
};

const BY_SOURCE: Record<string, Look> = {
  meta_whatsapp: { Icon: MessageCircle, tone: "bg-success/10 text-success" },
  meta_ads: { Icon: Megaphone, tone: "bg-pink/15 text-pink" },
  anthropic: { Icon: Sparkles, tone: "bg-primary/10 text-primary" },
};

/** Ícone do gasto: origem automática > tipo (brinquedo, roupa, embalagem) > categoria. */
export function ExpenseIcon({ expense, className }: { expense: Pick<Expense, "category" | "item_type" | "source">; className?: string }) {
  const look =
    (expense.source ? BY_SOURCE[expense.source] : undefined) ??
    (expense.item_type ? BY_ITEM_TYPE[expense.item_type] : undefined) ??
    BY_CATEGORY[expense.category];
  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", look.tone, className)} aria-hidden>
      <look.Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </span>
  );
}
