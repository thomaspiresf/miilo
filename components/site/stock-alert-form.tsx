"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { subscribeStockAlertAction } from "@/app/(loja)/actions";
import { createClient } from "@/lib/supabase/client";
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
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // se o cliente estiver logado, usa o e-mail da conta (não pede de novo)
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const e = data.user?.email;
        if (e) {
          setAccountEmail(e);
          setEmail(e);
        }
      })
      .catch(() => {});
  }, []);

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

  const alvo = variantLabel ? `o ${variantLabel}` : "este produto";

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-success">
          <Check className="h-5 w-5" /> Pronto!
        </p>
        <p className="mt-1 text-muted">
          A gente te avisa em <span className="font-medium text-foreground">{email}</span> assim que{" "}
          {alvo} voltar ao estoque.
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
        {accountEmail
          ? "Quer que a gente avise quando voltar?"
          : "Deixe seu e-mail que a gente avisa quando voltar."}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {!accountEmail && (
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="voce@email.com"
            className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        )}
        <Button
          onClick={submit}
          disabled={state === "loading"}
          className={accountEmail ? "w-full sm:w-auto" : "shrink-0"}
        >
          {state === "loading" ? <Spinner /> : "Avise-me quando chegar"}
        </Button>
      </div>

      {accountEmail && (
        <p className="mt-2 text-xs text-muted">Avisaremos em {accountEmail}</p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
