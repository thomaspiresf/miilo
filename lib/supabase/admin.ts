import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente Supabase com a chave service_role — IGNORA RLS.
 * Use SOMENTE em route handlers no servidor (webhooks, confirmação de pagamento,
 * baixa de estoque). Nunca importe isto em código de cliente.
 */
export function createAdminClient() {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — operação administrativa indisponível.",
    );
  }
  return createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
