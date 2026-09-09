"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

type Mode = "password" | "signup" | "magic";

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("already registered")) return "Já existe uma conta com esse e-mail. Faça login.";
  if (m.includes("password should be")) return "A senha precisa ter no mínimo 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
}

export function LoginForm({ next: rawNext, demo }: { next: string; demo: boolean }) {
  const router = useRouter();
  const next = safeNextPath(rawNext, "/conta");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<"" | "form" | "google">("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  if (demo) {
    return (
      <div className="rounded-xl bg-warning/10 p-4 text-sm text-warning">
        Login indisponível no modo demonstração. Configure{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para habilitar contas.
      </div>
    );
  }

  async function google() {
    setLoading("google");
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setLoading("");
      setError(friendly(error.message));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("form");
    setError(null);
    setNotice(null);
    const supabase = createClient();

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setNotice(`Enviamos um link de acesso para ${email}.`);
        return;
      }

      if (mode === "signup") {
        // cria a conta no servidor (senha já ativa, sem e-mail de confirmação)
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || null }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Falha ao criar conta");

        // já entra
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
        return;
      }

      // password
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Erro ao entrar"));
    } finally {
      setLoading("");
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError("Digite seu e-mail primeiro.");
      return;
    }
    setLoading("form");
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/conta/redefinir-senha`,
    });
    setLoading("");
    if (error) setError(friendly(error.message));
    else setNotice(`Enviamos um link para redefinir a senha para ${email}.`);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl bg-success/10 px-4 py-2.5 text-sm text-success">{notice}</p>
      )}

      {site.googleLogin && (
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={google}
            disabled={loading !== ""}
          >
            {loading === "google" ? <Spinner /> : "Continuar com Google"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> ou{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {mode !== "magic" && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`rounded-lg py-2 ${mode === "password" ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg py-2 ${mode === "signup" ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            Criar conta
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </Field>
        )}

        <Field label="E-mail">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </Field>

        {mode !== "magic" && (
          <Field
            label="Senha"
            hint={mode === "signup" ? "Mínimo 6 caracteres." : undefined}
          >
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        )}

        <Button type="submit" className="w-full" disabled={loading !== ""}>
          {loading === "form" ? (
            <Spinner />
          ) : mode === "magic" ? (
            "Enviar link de acesso"
          ) : mode === "signup" ? (
            "Criar conta"
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs text-muted">
        {mode === "password" && (
          <button type="button" onClick={forgotPassword} className="underline">
            Esqueci a senha
          </button>
        )}
        {mode !== "magic" ? (
          <button type="button" onClick={() => setMode("magic")} className="underline">
            Entrar com link mágico
          </button>
        ) : (
          <button type="button" onClick={() => setMode("password")} className="underline">
            Entrar com senha
          </button>
        )}
      </div>
    </div>
  );
}
