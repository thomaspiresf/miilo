"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Cliente Supabase para uso no browser (componentes "use client"). */
export function createClient() {
  return createBrowserClient(env.supabase.url, env.supabase.anonKey);
}
