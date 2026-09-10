import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente Supabase para Server Components e Route Handlers.
 * Usa a chave anon + cookies da sessão (respeita RLS).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado de um Server Component — o refresh de sessão fica a cargo do proxy.
        }
      },
    },
  });
}

/**
 * Cliente Supabase "público" — chave anon, SEM cookies de sessão.
 *
 * O catálogo é a mesma coisa pra todo mundo (RLS libera `select` no anon pra
 * linhas ativas), então ler sem cookies evita marcar as páginas da loja como
 * dinâmicas: home e página de produto passam a ser pré-renderadas + ISR, o que
 * torna a navegação instantânea. Singleton por processo — nada de estado por
 * request.
 */
let publicClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createPublicClient() {
  if (!publicClient) {
    publicClient = createSupabaseClient(env.supabase.url, env.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return publicClient;
}
