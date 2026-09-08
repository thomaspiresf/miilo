import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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
