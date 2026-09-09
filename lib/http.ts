import "server-only";
import { env } from "@/lib/env";

/**
 * Confere que a requisição veio do próprio site (proteção CSRF para route
 * handlers que dependem do cookie de sessão — as Server Actions do Next já
 * fazem isso sozinhas).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Fetch API sempre manda Origin em POST cross-site; se não veio, cai no
  // Sec-Fetch-Site (navegadores modernos).
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite === "same-origin" || secFetchSite === "none";

  if (!origin) return true; // sem pistas (ex.: curl) — deixa o auth guard decidir

  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    const site = new URL(env.site.url);
    return o.host === site.host;
  } catch {
    return false;
  }
}

export function forbiddenCrossOrigin(): Response {
  return new Response(JSON.stringify({ error: "Origem não permitida." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
