import Link from "next/link";
import { getCategories } from "@/lib/data/catalog";
import { isDemoMode } from "@/lib/auth";
import { SiteHeader } from "@/components/site/header";
import { Logo } from "@/components/site/logo";
import { AnalyticsScripts } from "@/components/site/analytics-scripts";
import { CookieConsent } from "@/components/site/cookie-consent";
import { env } from "@/lib/env";

export default async function LojaLayout({ children }: LayoutProps<"/">) {
  const [categories, demo] = await Promise.all([getCategories(), isDemoMode()]);

  return (
    <>
      {demo && (
        <div className="bg-warning/15 px-4 py-1.5 text-center text-xs font-medium text-warning">
          Modo demonstração — catálogo de exemplo, frete estimado e pagamento
          simulado. Configure o <code>.env.local</code> para dados reais.
        </div>
      )}
      <SiteHeader categories={categories} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
          <Logo variant="horizontal" className="h-8 w-auto" />
          <p className="mt-3 max-w-md">
            Roupas, brinquedos e livros infantis escolhidos com carinho.
            Enviamos para todo o Brasil.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/c/roupas">Roupas</Link>
            <Link href="/c/brinquedos">Brinquedos</Link>
            <Link href="/c/livros">Livros</Link>
            <Link href="/conta">Minha conta</Link>
            <Link href="/conta/pedidos">Meus pedidos</Link>
            <Link href="/privacidade">Privacidade</Link>
          </div>
          <p className="mt-6 text-xs">
            © {new Date().getFullYear()} {env.site.storeName}. Pagamentos via
            Mercado Pago. Fretes via Melhor Envio.
          </p>
        </div>
      </footer>
      <AnalyticsScripts />
      <CookieConsent />
    </>
  );
}
