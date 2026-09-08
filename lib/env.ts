/**
 * Acesso central às variáveis de ambiente + flags de modo demonstração.
 * Quando uma integração não está configurada, o app cai num fallback local.
 */

function bool(v: string | undefined, fallback = false) {
  if (v == null || v === "") return fallback;
  return v === "true" || v === "1";
}

export const env = {
  site: {
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    storeName: process.env.NEXT_PUBLIC_STORE_NAME || "miilo",
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  mercadopago: {
    publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "",
    accessToken: process.env.MP_ACCESS_TOKEN || "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET || "",
    mock: bool(process.env.MOCK_PAYMENTS, true),
  },
  melhorEnvio: {
    token: process.env.MELHOR_ENVIO_TOKEN || "",
    sandbox: bool(process.env.MELHOR_ENVIO_SANDBOX, true),
    originCep: (process.env.STORE_ORIGIN_CEP || "01001000").replace(/\D/g, ""),
    // o Melhor Envio pede um User-Agent identificável (app + e-mail de contato)
    userAgent:
      process.env.MELHOR_ENVIO_USER_AGENT ||
      `${process.env.NEXT_PUBLIC_STORE_NAME || "miilo"} (${process.env.MELHOR_ENVIO_CONTACT_EMAIL || "contato@miilo.com.br"})`,
    mock: bool(process.env.MOCK_SHIPPING, true),
  },
  /** Libera o /admin sem login — SÓ em desenvolvimento. */
  adminDevBypass: bool(process.env.ADMIN_DEV_BYPASS, false),
  seedToken: process.env.SEED_TOKEN || "",
  /** E-mails com acesso ao painel /admin (lista branca). */
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

/** O e-mail informado é de um administrador? */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return env.adminEmails.includes(email.trim().toLowerCase());
}

export const isProd = process.env.NODE_ENV === "production";

/** /admin acessível sem autenticação (bypass de dev). */
export function adminBypassActive() {
  return env.adminDevBypass && !isProd;
}

/** Supabase configurado o suficiente para leitura pública (catálogo). */
export function hasSupabase() {
  return Boolean(env.supabase.url && env.supabase.anonKey);
}

/** Supabase configurado para escrita sensível (webhooks, admin server-side). */
export function hasSupabaseAdmin() {
  return Boolean(env.supabase.url && env.supabase.serviceRoleKey);
}

/** Mercado Pago pronto para cobranças reais. */
export function hasMercadoPago() {
  return Boolean(env.mercadopago.accessToken && env.mercadopago.publicKey);
}

export function paymentsMocked() {
  return env.mercadopago.mock || !hasMercadoPago();
}

export function shippingMocked() {
  return env.melhorEnvio.mock || !env.melhorEnvio.token;
}
