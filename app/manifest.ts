import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${env.site.storeName} — roupas e brinquedos infantis`,
    short_name: env.site.storeName,
    description: "Loja de roupas e brinquedos infantis.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#ff514f",
    icons: [
      { src: "/logo/2x/icon_positivo@2x.png", sizes: "410x345", type: "image/png" },
    ],
  };
}
