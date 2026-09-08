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
  /** Texto mostrado no checkout quando o cliente escolhe "Retirar na loja". */
  pickupNote:
    process.env.NEXT_PUBLIC_STORE_PICKUP_NOTE ||
    "Avisaremos por e-mail e WhatsApp quando o pedido estiver pronto para retirada.",
};
