import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-black">Privacidade e cookies</h1>
        <p className="mt-2 text-sm text-muted">
          Um resumo simples de que dados a {site.name} coleta ao navegar no site e
          pra que servem.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-black">O que coletamos ao navegar</h2>
        <p className="text-sm text-muted">
          Quando você aceita os cookies do banner, usamos duas ferramentas pra
          entender o site e melhorar os anúncios:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            <span className="font-semibold text-foreground">Google Analytics</span> —
            quais páginas você visita, de onde veio (Google, Instagram, link direto…)
            e, quando você compra, o valor e os itens do pedido. Não inclui seu nome,
            e-mail ou endereço.
          </li>
          <li>
            <span className="font-semibold text-foreground">Meta Pixel</span> (Facebook
            e Instagram) — quais produtos você viu, adicionou à sacola ou comprou,
            usado pra mostrar anúncios da {site.name} mais relevantes pra você e medir
            se um anúncio resultou em venda.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-black">O que NÃO fazemos</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Não vendemos seus dados pra terceiros.</li>
          <li>
            Não mandamos seu nome, e-mail, telefone ou endereço pro Google ou Meta —
            só o comportamento de navegação (páginas, produtos, valores).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-black">Dados do pedido</h2>
        <p className="text-sm text-muted">
          Nome, e-mail, telefone e endereço que você informa no checkout ficam só
          com a {site.name} (pra entregar o pedido e falar com você) e com o
          Mercado Pago (pra processar o pagamento) e a transportadora (pra fazer a
          entrega). Isso é separado dos cookies de analytics acima.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-black">Suas escolhas</h2>
        <p className="text-sm text-muted">
          Você pode recusar os cookies de analytics no banner que aparece ao entrar
          no site, ou limpar essa escolha a qualquer momento apagando os dados do
          site no seu navegador. Recusar não impede nenhuma funcionalidade de compra.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-black">Contato</h2>
        <p className="text-sm text-muted">
          Dúvidas sobre seus dados? Escreva pra{" "}
          <a href={`mailto:${site.privacyEmail}`} className="font-semibold underline">
            {site.privacyEmail}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
