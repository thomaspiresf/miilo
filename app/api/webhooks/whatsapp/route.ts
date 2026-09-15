import { NextResponse } from "next/server";
import { verifyMetaSignature, isAuthorizedWhatsAppNumber, handleWhatsAppMessage } from "@/lib/whatsapp-bot";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Webhook do WhatsApp Cloud API (Meta) — GET faz a verificação inicial que a
 * Meta pede ao cadastrar a URL; POST recebe as mensagens de verdade.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(request: Request) {
  const raw = await request.text();

  // Sem assinatura válida, não processa nada — sem isso, qualquer requisição
  // de fora poderia forjar "de: seu número" e criar pedido/baixar estoque.
  // Ainda assim responde 200 pra Meta não ficar reenviando o mesmo evento.
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp webhook] assinatura ausente ou inválida");
    return NextResponse.json({ ok: true });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages as any[] | undefined;
  if (!messages?.length) return NextResponse.json({ ok: true });

  for (const msg of messages) {
    if (msg?.type !== "text" || typeof msg.text?.body !== "string") continue;
    const from = String(msg.from ?? "");

    if (!isAuthorizedWhatsAppNumber(from)) {
      // não revela nem responde pra número que não está na lista
      console.warn(`[whatsapp webhook] número não autorizado tentou comandar o bot: ${from}`);
      continue;
    }

    try {
      const reply = await handleWhatsAppMessage(msg.text.body, from);
      await sendWhatsAppText(from, reply);
    } catch (err) {
      console.error("[whatsapp webhook] erro ao processar mensagem", err);
      await sendWhatsAppText(from, "Deu um erro aqui do meu lado. Tenta de novo em instantes.").catch(
        () => {},
      );
    }
  }

  return NextResponse.json({ ok: true });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
