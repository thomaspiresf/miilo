import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.site.url),
  title: {
    default: `${env.site.storeName} — roupas e brinquedos infantis`,
    template: `%s · ${env.site.storeName}`,
  },
  description:
    "Roupas e brinquedos infantis selecionados. Compre pelo celular, pague com Pix ou cartão e receba em casa.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: env.site.storeName,
  },
};

export const viewport: Viewport = {
  // combina com o fundo do cabeçalho (a barra de status do iOS/Android usa isso)
  themeColor: "#fbfbfd",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
