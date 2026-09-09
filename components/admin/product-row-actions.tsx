"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/misc";
import {
  toggleProductActiveAction,
  deleteProductAction,
} from "@/app/admin/actions";

export function ProductRowActions({
  id,
  name,
  active,
  className,
}: {
  id: string;
  name: string;
  active: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [busy, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next);
    setErr(null);
    start(async () => {
      const res = await toggleProductActiveAction(id, next);
      if (res?.error) {
        setOn(!next);
        setErr(res.error);
      }
    });
  }

  function del() {
    if (
      !window.confirm(
        `Apagar "${name}" de vez? Não dá pra desfazer. (O histórico de pedidos é mantido.)`,
      )
    )
      return;
    setErr(null);
    startDelete(async () => {
      const res = await deleteProductAction(id);
      if (res?.error) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className={cn("flex shrink-0 flex-col items-end gap-1", className)}>
      <div className="flex items-center gap-2">
        {/* toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
          disabled={busy}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            on ? "bg-success" : "bg-black/20",
            busy && "opacity-60",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              on ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </button>
        <span
          className={cn(
            "w-11 text-[11px] font-semibold",
            on ? "text-muted" : "text-danger",
          )}
        >
          {on ? "ativo" : "inativo"}
        </span>

        {/* editar */}
        <Link
          href={`/admin/produtos/${id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-black/[0.04]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Link>

        {/* apagar */}
        <button
          type="button"
          onClick={del}
          disabled={deleting}
          aria-label="Apagar produto"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          {deleting ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {err && <span className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
