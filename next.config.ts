import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
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
