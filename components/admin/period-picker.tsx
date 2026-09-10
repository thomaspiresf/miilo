"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/misc";

export type PeriodKey = "7" | "15" | "30" | "90" | "all" | "custom";
export type PeriodRange = { days?: 7 | 15 | 30 | 90; from?: string; to?: string };

const CHIPS: { key: PeriodKey; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "15", label: "15 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
];

const brDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function periodLabels(period: PeriodKey, from: string, to: string) {
  if (period === "all") return { short: "Tudo", long: "Todo o período" };
  if (period === "custom") {
    if (from && to)
      return {
        short: `${brDate(from)}–${brDate(to)}`,
        long: `De ${brDate(from)} a ${brDate(to)}`,
      };
    return { short: "Personalizado", long: "Período personalizado" };
  }
  return { short: `${period}d`, long: `Últimos ${period} dias` };
}

export function PeriodPicker({
  initial = "30",
  pending,
  error,
  onChange,
}: {
  initial?: PeriodKey;
  pending?: boolean;
  error?: string | null;
  onChange: (
    range: PeriodRange,
    labels: { short: string; long: string },
  ) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);

  const { short } = periodLabels(period, from, to);

  function fire(next: PeriodKey, f: string, t: string) {
    setPeriod(next);
    const labels = periodLabels(next, f, t);
    if (next === "all") onChange({}, labels);
    else if (next === "custom") onChange({ from: f, to: t }, labels);
    else onChange({ days: Number(next) as 7 | 15 | 30 | 90 }, labels);
    if (next !== "custom") setOpen(false);
  }

  function pick(key: PeriodKey) {
    if (key === "custom") {
      setPeriod("custom");
      if (!from || !to) {
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const past = new Date();
        past.setDate(past.getDate() - 30);
        setFrom(iso(past));
        setTo(iso(new Date()));
      }
      return;
    }
    fire(key, from, to);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
          open
            ? "border-foreground text-foreground"
            : "border-border text-muted hover:text-foreground",
        )}
      >
        <CalendarDays className="h-4 w-4" />
        <span>{short}</span>
        {pending && <Spinner className="h-3 w-3" />}
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-border bg-surface p-3 shadow-lg">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Período
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pick(c.key)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                    period === c.key
                      ? "bg-foreground text-background"
                      : "border border-border text-muted hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-muted">
                  De
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
                <label className="block text-[11px] text-muted">
                  Até
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
                <button
                  type="button"
                  disabled={!from || !to || pending}
                  onClick={() => fire("custom", from, to)}
                  className="w-full rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
