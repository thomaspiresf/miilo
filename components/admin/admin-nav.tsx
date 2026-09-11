"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  Calculator,
  LayoutDashboard,
  Package,
  Receipt,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/misc";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** outras rotas que devem manter este item aceso (ex.: sub-páginas sem link próprio) */
  matches?: string[];
};

const LINKS: NavLink[] = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/pdv", label: "Venda na loja", icon: Store },
  {
    href: "/admin/produtos",
    label: "Produtos",
    icon: Package,
    matches: ["/admin/categorias", "/admin/cupons"],
  },
  { href: "/admin/estoque", label: "Estoque", icon: Boxes },
  { href: "/admin/precificacao", label: "Precificação", icon: Calculator },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/admin/atividade", label: "Atividade", icon: Activity },
];

const MASTER_LINKS: NavLink[] = [
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
];

/** Fica dentro do <Link>: troca o ícone por um spinner enquanto a página carrega. */
function NavItemBody({ label, Icon }: { label: string; Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <Spinner className="h-4 w-4 shrink-0" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      <span className={cn("whitespace-nowrap", pending && "opacity-70")}>
        {label}
      </span>
    </>
  );
}

export function AdminNav({ master = false }: { master?: boolean }) {
  const pathname = usePathname();
  const links = master ? [...LINKS, ...MASTER_LINKS] : LINKS;
  return (
    <nav className="flex gap-1 overflow-x-auto no-scrollbar md:flex-col">
      {links.map((l) => {
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(l.href) ||
              (l.matches?.some((m) => pathname.startsWith(m)) ?? false);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-black/5 active:bg-black/[0.08]",
            )}
          >
            <NavItemBody label={l.label} Icon={l.icon} />
          </Link>
        );
      })}
    </nav>
  );
}
