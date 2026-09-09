"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "relevancia", label: "Nome (A–Z)" },
  { value: "preco-asc", label: "Menor preço" },
  { value: "preco-desc", label: "Maior preço" },
  { value: "novidades", label: "Novidades" },
];

const AGES = [
  { value: "", label: "Todas" },
  { value: "3", label: "0–3 meses" },
  { value: "9", label: "3–12 meses" },
  { value: "18", label: "1–2 anos" },
  { value: "36", label: "3 anos" },
  { value: "60", label: "5 anos" },
  { value: "84", label: "7 anos" },
];

export function Filters({ sizes }: { sizes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selectedSizes = params.get("sizes")?.split(",").filter(Boolean) ?? [];

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  function toggleSize(s: string) {
    const set = new Set(selectedSizes);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    update({ sizes: [...set].join(",") || null });
  }

  const hasAny =
    [...params.keys()].filter((k) => k !== "q").length > 0;

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-black">Filtros</h3>
        {hasAny && (
          <button
            onClick={() => router.replace(pathname, { scroll: false })}
            className="text-xs font-semibold text-primary"
          >
            limpar
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 font-semibold">Ordenar por</p>
        <select
          value={params.get("sort") ?? "relevancia"}
          onChange={(e) => update({ sort: e.target.value === "relevancia" ? null : e.target.value })}
          className="h-10 w-full rounded-xl border border-border bg-surface px-3"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => toggleSize(s)}
                className={cn(
                  "min-w-10 rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                  selectedSizes.includes(s)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-semibold">Idade</p>
        <select
          value={params.get("age") ?? ""}
          onChange={(e) => update({ age: e.target.value || null })}
          className="h-10 w-full rounded-xl border border-border bg-surface px-3"
        >
          {AGES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 font-semibold">Menino / Menina</p>
        <div className="flex gap-2">
          {[
            { v: "", l: "Todos" },
            { v: "menino", l: "Menino" },
            { v: "menina", l: "Menina" },
          ].map((g) => (
            <button
              key={g.v}
              onClick={() => update({ gender: g.v || null })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                (params.get("gender") ?? "") === g.v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface",
              )}
            >
              {g.l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold">Preço até</p>
        <select
          value={params.get("max") ?? ""}
          onChange={(e) => update({ max: e.target.value || null })}
          className="h-10 w-full rounded-xl border border-border bg-surface px-3"
        >
          <option value="">Sem limite</option>
          <option value="50">R$ 50</option>
          <option value="100">R$ 100</option>
          <option value="150">R$ 150</option>
          <option value="250">R$ 250</option>
        </select>
      </div>
    </div>
  );
}
