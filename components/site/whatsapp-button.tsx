import { site } from "@/lib/site";

const DEFAULT_MESSAGE = "Oi! Vim pelo site da miilo 🙂";

/** Botão flutuante que abre o WhatsApp direto na conversa com o bot de atendimento da loja. */
export function WhatsAppButton() {
  const href = `https://wa.me/${site.storeWhatsapp}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      // bottom-24 no mobile pra não ficar em cima da barra fixa "Comprar
      // agora" da página de produto (components/site/product-buy-box.tsx)
      className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 sm:bottom-5"
    >
      <svg viewBox="0 0 32 32" fill="currentColor" className="h-8 w-8" aria-hidden="true">
        <path d="M16.001 3C9.376 3 4 8.373 4 15c0 2.625.86 5.056 2.313 7.021L4 29l7.157-2.278A11.94 11.94 0 0 0 16.001 27C22.626 27 28 21.627 28 15S22.626 3 16.001 3zm0 21.938a9.9 9.9 0 0 1-5.05-1.383l-.362-.215-4.246 1.351 1.377-4.137-.236-.377A9.906 9.906 0 0 1 6.062 15c0-5.478 4.46-9.938 9.939-9.938S25.938 9.522 25.938 15 21.479 24.938 16.001 24.938zm5.46-7.44c-.298-.149-1.762-.869-2.036-.968-.273-.099-.472-.149-.671.149-.198.298-.769.968-.943 1.166-.174.198-.347.223-.645.074-.298-.149-1.259-.464-2.399-1.481-.887-.791-1.486-1.769-1.66-2.067-.174-.298-.019-.459.13-.607.134-.133.298-.347.447-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.671-1.615-.919-2.212-.242-.581-.489-.502-.671-.512-.174-.008-.372-.01-.571-.01a1.09 1.09 0 0 0-.79.372c-.273.298-1.042 1.018-1.042 2.484s1.067 2.881 1.216 3.079c.149.198 2.1 3.204 5.086 4.494.711.307 1.266.49 1.699.627.714.227 1.363.195 1.876.118.572-.085 1.762-.72 2.011-1.416.248-.695.248-1.291.174-1.416-.074-.124-.273-.198-.571-.347z" />
      </svg>
    </a>
  );
}
