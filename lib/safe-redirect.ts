/**
 * Só aceita caminho relativo do próprio site como destino de redirect.
 * Bloqueia open redirect via `?next=` (`https://…`, `//host`, `/\host`, `@host`).
 */
export function safeNextPath(next: unknown, fallback = "/conta"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/")) return fallback; // precisa ser caminho absoluto do site
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback; // protocol-relative
  if (next.includes("://") || next.includes("\\")) return fallback;
  return next;
}
