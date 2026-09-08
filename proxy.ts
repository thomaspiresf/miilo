import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { hasSupabase } from "@/lib/env";

/**
 * Next.js 16: o antigo `middleware` agora chama-se `proxy`.
 * Aqui só fazemos o refresh do cookie de sessão do Supabase.
 * A proteção de /admin e /conta é feita nos próprios layouts (server-side).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!hasSupabase()) return response;

  const supabase = createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
