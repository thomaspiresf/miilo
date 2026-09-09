"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { subscribeStockAlertAction } from "@/app/(loja)/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

export function StockAlertForm({
  productId,
  variantId,
  variantLabel,
}: {
  productId: string;
  variantId: string | null;
  variantLabel?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
    const res = await subscribeStockAlertAction({ productId, variantId, email });
    if ("error" in res) {
      setError(res.error);
      setState("idle");
    } else {
      setState("done");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-success">
          <Check className="h-5 w-5" /> Pronto!
        </p>
        <p className="mt-1 text-muted">
          A gente te avisa por e-mail assim que
          {variantLabel ? ` o ${variantLabel} ` : " este produto "}
          voltar ao estoque.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Bell className="h-4 w-4" /> Esgotado
      </p>
      <p className="mt-1 text-sm text-muted">
        {variantLabel ? `O ${variantLabel} acabou. ` : "Esse produto acabou. "}
        Deixe seu e-mail que a gente avisa quando voltar.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="voce@email.com"
          className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <Button onClick={submit} disabled={state === "loading"} className="shrink-0">
          {state === "loading" ? <Spinner /> : "Avise-me"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
