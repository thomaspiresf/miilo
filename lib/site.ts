/** Config pública, segura para importar em componentes de cliente. */
export const site = {
  name: process.env.NEXT_PUBLIC_STORE_NAME || "miilo",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  mpPublicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "",
  /** Mostra o botão "Continuar com Google" (só ative depois de habilitar o provedor no Supabase). */
  googleLogin: process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true",
  /** Endereço da loja para retirada. */
  storeAddress:
    process.env.NEXT_PUBLIC_STORE_ADDRESS ||
    "R. Alfredo Barbieri, 92 — Vila Conceição, Laranjal Paulista/SP",
  /**
   * Entrega pelos Correios ligada? Desligada em 2026-09-13 — ainda falta
   * configurar o necessário para despachar pedidos. Só retirada na loja por
   * enquanto. Religar aqui (e no servidor, em checkout-schema.ts) quando o
   * frete estiver pronto.
   */
  deliveryEnabled: process.env.NEXT_PUBLIC_DELIVERY_ENABLED === "true",
  /** Texto mostrado no checkout quando o cliente escolhe "Retirar na loja". */
  pickupNote:
    process.env.NEXT_PUBLIC_STORE_PICKUP_NOTE ||
    "Avisaremos por e-mail e WhatsApp quando o pedido estiver pronto para retirada.",
  /** Google Analytics 4 — Admin do GA -> Fluxo de dados -> ID de métricas (G-XXXXXXX). Vazio = desligado. */
  gaId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  /** Meta Pixel (Facebook/Instagram Ads) — Gerenciador de Eventos -> ID do pixel. Vazio = desligado. */
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  /** E-mail de contato pra dúvidas de privacidade/dados. */
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "contato@miilo.com.br",
  /** Número do WhatsApp da loja (DDI+DDD+número, só dígitos) — botão flutuante da loja fala com o bot de atendimento por aqui. */
  storeWhatsapp: process.env.NEXT_PUBLIC_STORE_WHATSAPP || "5515991020168",
};
