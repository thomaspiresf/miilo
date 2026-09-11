"use client";

import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { site } from "@/lib/site";
import { useConsent } from "@/lib/analytics";

/**
 * Carrega o GA4 e o Meta Pixel só depois que o cliente aceita o banner de
 * cookies (LGPD) — antes disso nada é carregado, nenhum evento é enfileirado.
 * Sem as variáveis de ambiente configuradas, cada script fica desligado.
 */
export function AnalyticsScripts() {
  const consent = useConsent();
  if (consent !== "accepted") return null;

  return (
    <>
      {site.gaId && <GoogleAnalytics gaId={site.gaId} />}
      {site.metaPixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${site.metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              alt=""
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${site.metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
