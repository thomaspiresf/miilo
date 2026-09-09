import "server-only";

/**
 * Rate limiter simples em memória (janela deslizante por chave).
 *
 * Observação: no Vercel cada instância serverless tem o próprio mapa, então o
 * limite real é "por instância". Isso já corta abuso automatizado de um IP sem
 * depender de Redis. Para limites duros, migrar para Upstash/Vercel KV.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// evita vazamento de memória em processos longos (dev)
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * @param key    identificador (ex.: `signup:${ip}`)
 * @param limit  máximo de requisições na janela
 * @param windowMs  tamanho da janela em ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  hit.count += 1;
  if (hit.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((hit.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - hit.count, retryAfterSeconds: 0 };
}

/** IP do cliente a partir dos headers da Vercel/proxy. */
export function clientIp(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
}

/** Resposta 429 padrão. */
export function tooMany(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "Muitas tentativas. Aguarde um momento e tente de novo." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}
