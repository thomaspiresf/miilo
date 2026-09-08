import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().max(120).optional().nullable(),
});

/**
 * Cria a conta com a senha já ativa (sem depender do e-mail de confirmação
 * do Supabase). Depois o cliente faz signInWithPassword normalmente.
 */
export async function POST(request: Request) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Contas indisponíveis." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error:
          issue?.path[0] === "password"
            ? "A senha precisa ter no mínimo 6 caracteres."
            : "E-mail inválido.",
      },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  if (!hasSupabaseAdmin()) {
    return NextResponse.json(
      { error: "Configuração de servidor incompleta (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { full_name: name } : undefined,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json(
        { error: "Já existe uma conta com esse e-mail. Faça login." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
