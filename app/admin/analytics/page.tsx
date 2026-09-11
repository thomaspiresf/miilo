import Link from "next/link";
import { ArrowUpRight, Eye, ShoppingBag, CreditCard, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { site } from "@/lib/site";

export default function AdminAnalyticsPage() {
  const gaOn = Boolean(site.gaId);
  const metaOn = Boolean(site.metaPixelId);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-black">Analytics</h1>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">Google Analytics 4</p>
          <Badge tone={gaOn ? "success" : "neutral"}>
            {gaOn ? "ativo" : "não configurado"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">
          {gaOn
            ? "Toda a loja está sendo medida — visitas, produtos vistos, sacola e vendas confirmadas."
            : "Configure NEXT_PUBLIC_GA_MEASUREMENT_ID na Vercel pra ativar."}
        </p>
        {gaOn && (
          <a
            href="https://analytics.google.com/analytics/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Abrir o Google Analytics
            <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">Meta Pixel</p>
          <Badge tone={metaOn ? "success" : "neutral"}>
            {metaOn ? "ativo" : "não configurado"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">
          {metaOn
            ? "Os anúncios do Instagram/Facebook recebem os eventos de compra."
            : "Desligado por enquanto — só faz sentido quando começarem os anúncios no Instagram/Facebook."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="font-black">O que é medido</p>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">Visualização de produto</span> — toda vez
              que um cliente abre a página de um produto.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">Adicionar à sacola</span> — quando clica
              em &quot;Adicionar&quot; ou &quot;Comprar agora&quot;.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">Início de checkout</span> — chegou na tela
              de pagamento com itens na sacola.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <span className="font-semibold">Compra</span> — pedido confirmado como
              pago, com valor e itens.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Só conta quem aceita o banner de cookies, e nunca inclui nome, e-mail,
          telefone ou endereço — veja em{" "}
          <Link href="/privacidade" className="font-semibold underline">
            /privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
