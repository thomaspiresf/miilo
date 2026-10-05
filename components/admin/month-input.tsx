"use client";

import { useRouter } from "next/navigation";

/** Escolhe um mês direto no calendário do navegador e filtra a página por ele. */
export function MonthInput({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      aria-label="Escolher mês"
      value={value}
      max={max}
      onChange={(e) => {
        if (e.target.value) router.push(`/admin/gastos?periodo=${e.target.value}`);
      }}
      className="h-8 rounded-lg border border-border bg-surface px-2 text-[13px] outline-none focus:border-primary"
    />
  );
}
