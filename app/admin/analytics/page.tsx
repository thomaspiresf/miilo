import Link from "next/link";
import { ArrowUpRight, Eye, ShoppingBag, CreditCard, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";
import { hasGaData } from "@/lib/env";
import { getGaOverview } from "@/lib/data/ga";
import { GaDashboard } from "@/components/admin/ga-dashboard";

export default async function AdminAnalyticsPage() {
  const gaOn = Boolean(site.gaId);
  const metaOn = Boolean(site.metaPixelId);
  const gaDataReady = hasGaData();
  const overview = gaDataReady ? await getGaOverview({ days: 30 }) : null;
  const dashboardReady = Boolean(overview && !("error" in overview));

  return (
    <div className={cn("space-y-6", dashboardReady ? "max-w-5xl" : "max-w-2xl")}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">Analytics</h1>
        <Badge tone={gaOn ? "success" : "neutral"}>
          GA4 {gaOn ? "ativo" : "não configurado"}
        </Badge>
        <Badge tone={metaOn ? "success" : "neutral"}>
          Meta Pixel {metaOn ? "ativo" : "não configurado"}
        </Badge>
      </div>

      {overview && !("error" in overview) ? (
        <GaDashboard initial={overview} />
      ) : (
        <>
          {overview && "error" in overview && (
            <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {overview.error}
            </div>
          )}

          {!gaOn && (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
              Configure <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> na Vercel antes —
              sem isso o site nem manda dados pro Google Analytics.
            </div>
          )}

          {!gaDataReady && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="font-black">Ativar o dashboard aqui dentro</p>
              <p className="mt-1 text-sm text-muted">
                O que aparece no site (GA4) e o que a gente consegue LER de volta são
                duas chaves diferentes. Pra trazer os números pra dentro do admin,
                precisa de uma conta de serviço do Google com acesso de leitor:
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>
                  No{" "}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline"
                  >
                    Google Cloud Console
                  </a>
                  , crie (ou use) um projeto e ative a{" "}
                  <strong>Google Analytics Data API</strong> (busque o nome em
                  &ldquo;APIs e serviços → Biblioteca&rdquo;).
                </li>
                <li>
                  Em &ldquo;IAM e administrador → Contas de serviço&rdquo;, crie uma
                  conta de serviço (ex.: <code>miilo-analytics-reader</code>) e gere
                  uma <strong>chave JSON</strong> pra ela (aba &ldquo;Chaves&rdquo; →
                  Adicionar chave).
                </li>
                <li>
                  No Google Analytics, vá em <strong>Admin → Gerenciamento de acesso
                  à propriedade</strong> e adicione o e-mail da conta de serviço (algo
                  como <code>...@...iam.gserviceaccount.com</code>) como{" "}
                  <strong>Leitor</strong>.
                </li>
                <li>
                  Ainda no Admin, em &ldquo;Detalhes da propriedade&rdquo;, copie o{" "}
                  <strong>ID da propriedade</strong> (um número — diferente do
                  <code> G-XXXXXXX</code> que já configuramos).
                </li>
                <li>
                  Me manda o ID da propriedade e o arquivo JSON da chave (ou só{" "}
                  <code>client_email</code> e <code>private_key</code> de dentro dele)
                  — eu configuro as variáveis <code>GA_PROPERTY_ID</code>,{" "}
                  <code>GA_SERVICE_ACCOUNT_EMAIL</code> e{" "}
                  <code>GA_SERVICE_ACCOUNT_PRIVATE_KEY</code> na Vercel.
                </li>
              </ol>
            </div>
          )}
        </>
      )}

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
    </div>
  );
}
