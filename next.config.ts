import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

/**
 * Content-Security-Policy.
 * Precisa liberar o SDK/Bricks do Mercado Pago (checkout transparente),
 * o Supabase (auth + imagens), ViaCEP (busca de CEP) e os players de vídeo.
 */
const csp = [
  "default-src 'self'",
  // Next injeta scripts inline; o SDK do Mercado Pago usa eval.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // vídeos dos produtos hospedados no Supabase Storage
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://viacep.com.br`,
  "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Segura os segmentos de página no cache do cliente por um tempo: navegar
  // entre telas do admin já visitadas há pouco fica instantâneo (sem ida ao
  // servidor). Uma mutação (revalidatePath) limpa esse cache pro caminho.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // No modo demonstração (sem Supabase) as imagens são externas (picsum);
    // desligar a otimização evita gargalo no dev e mantém o preview rápido.
    unoptimized: !supabaseUrl,
    remotePatterns: [
      // Supabase Storage (quando configurado)
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Imagens de exemplo usadas no modo mock
      { protocol: "https" as const, hostname: "images.unsplash.com" },
      { protocol: "https" as const, hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
