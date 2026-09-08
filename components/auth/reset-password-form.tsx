"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function ResetPasswordForm() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setHasSession(Boolean(data.session)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/conta");
      router.refresh();
    }, 1500);
  }

  if (hasSession === null) {
    return <Spinner className="text-muted" />;
  }

  if (!hasSession) {
    return (
      <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
        Link inválido ou expirado. Peça um novo em{" "}
        <a href="/conta/login" className="underline">
          Entrar → Esqueci a senha
        </a>
        .
      </p>
    );
  }

  if (done) {
    return (
      <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
        Senha atualizada! Redirecionando…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>
      )}
      <Field label="Nova senha" hint="Mínimo 6 caracteres.">
        <Input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Confirme a nova senha">
        <Input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Spinner /> : "Salvar nova senha"}
      </Button>
    </form>
  );
}
