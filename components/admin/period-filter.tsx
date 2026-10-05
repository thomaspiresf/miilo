"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MonthOption = { ym: string; label: string };

/**
 * Filtro de período recolhido num botão: mostra só o período atual e abre um
 * painel com o seletor de mês e o intervalo livre de datas. Navega por URL
 * (?periodo=...), então a página continua sendo renderizada no servidor.
 */
export function PeriodFilter({
  label,
  periodKey,
  month,
  months,
  from,
  to,
  today,
  basePath = "/admin/gastos",
}: {
  label: string;
  periodKey: string;
  /** "YYYY-MM" quando o período é um mês inteiro */
  month: string | null;
  months: MonthOption[];
  from: string;
  to: string;
  today: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(from);
  const [ate, setAte] = useState(to);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (periodo: string, extra = "") => {
    setOpen(false);
    router.push(`${basePath}?periodo=${periodo}${extra}`);
  };

  const filtered = periodKey !== "tudo";
  const selectValue = periodKey === "tudo" ? "tudo" : month && months.some((m) => m.ym === month) ? month : "";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
          filtered
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-surface text-foreground hover:border-foreground/30",
        )}
      >
        <CalendarDays className="h-4 w-4" />
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filtrar período"
          className="absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-border bg-background p-4 shadow-xl"
        >
          <label className="block text-xs font-medium text-muted">
            Mês
            <select
              value={selectValue}
              onChange={(e) => e.target.value && go(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm font-normal text-foreground outline-none focus:border-primary"
            >
              <option value="tudo">Todo o período</option>
              {selectValue === "" && (
                <option value="" disabled>
                  Intervalo personalizado
                </option>
              )}
              {months.map((m) => (
                <option key={m.ym} value={m.ym}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted">Intervalo</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={de}
                max={today}
                onChange={(e) => setDe(e.target.value)}
                aria-label="De"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-[13px] outline-none focus:border-primary"
              />
              <span className="text-xs text-muted">até</span>
              <input
                type="date"
                value={ate}
                max={today}
                onChange={(e) => setAte(e.target.value)}
                aria-label="Até"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-[13px] outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              disabled={!de || !ate}
              onClick={() => go("custom", `&de=${de}&ate=${ate}`)}
              className="h-9 w-full rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-40"
            >
              Aplicar intervalo
            </button>
          </div>

          {filtered && (
            <button
              type="button"
              onClick={() => go("tudo")}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtro (ver tudo)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
