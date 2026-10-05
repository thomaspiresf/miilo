"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { syncMetaSpendAction } from "@/app/admin/gastos/actions";
import type { SyncLine } from "@/lib/meta-sync";
import { cn } from "@/lib/utils";

/** Puxa agora os custos da Meta (WhatsApp e anúncios) para a lista de gastos. */
export function MetaSyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<SyncLine[] | null>(null);

  function run() {
    setLines(null);
    startTransition(async () => {
      const res = await syncMetaSpendAction();
      setLines(res.lines);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="outline" onClick={run} disabled={pending}>
        {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Sincronizar Meta
      </Button>
      {lines && (
        <ul className="max-w-xs space-y-0.5 text-right text-xs">
          {lines.map((l) => (
            <li
              key={l.source}
              className={cn(l.status === "ok" && "text-success", l.status === "error" && "text-danger", l.status === "skipped" && "text-muted")}
            >
              <span className="font-semibold">{l.label}:</span> {l.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
