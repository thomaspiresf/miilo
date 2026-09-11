"use client";

import Link from "next/link";
import { useConsent, setConsent } from "@/lib/analytics";
import { site } from "@/lib/site";

/** Banner de cookies (LGPD) — só aparece se GA4 e/ou Meta Pixel estiverem configurados. */
export function CookieConsent() {
  const consent = useConsent();
  if (consent !== null) return null;
  if (!site.gaId && !site.metaPixelId) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Usamos cookies de análise e anúncios (Google Analytics e Meta) pra entender
          como você usa o site e mostrar anúncios mais relevantes.{" "}
          <Link href="/privacidade" className="font-semibold text-foreground underline">
            Saiba mais
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent("declined")}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-black/5"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
