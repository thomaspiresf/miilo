"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CATS: { id: string; label: string }[] = [
  { id: "", label: "Todas as áreas" },
  { id: "product", label: "Produtos" },
  { id: "stock", label: "Estoque" },
  { id: "order", label: "Pedidos" },
  { id: "pos", label: "Venda na loja" },
  { id: "coupon", label: "Cupons" },
  { id: "category", label: "Categorias" },
  { id: "user", label: "Usuários" },
];

export function AuditFilters({ actors }: { actors: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("limit");
    router.push(`/admin/atividade?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={sp.get("actor") ?? ""}
        onChange={(e) => set("actor", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
      >
        <option value="">Todos os administradores</option>
        {actors.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select
        value={sp.get("cat") ?? ""}
        onChange={(e) => set("cat", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
      >
        {CATS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
