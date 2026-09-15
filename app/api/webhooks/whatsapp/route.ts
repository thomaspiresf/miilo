import { NextResponse } from "next/server";
import { verifyMetaSignature, isAuthorizedWhatsAppNumber, handleWhatsAppMessage } from "@/lib/whatsapp-bot";
import { handlePublicMessage } from "@/lib/whatsapp-public-bot";
import { attachWamid, updateMessageStatus } from "@/lib/whatsapp-shared";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Webhook do WhatsApp Cloud API (Meta) — GET faz a verificação inicial que a
 * Meta pede ao cadastrar a URL; POST recebe as mensagens de verdade.
 *
 * Roteamento: número confiável (WHATSAPP_NOTIFY_NUMBERS) cai no bot interno
 * (lib/whatsapp-bot.ts — vendas, estoque exato, pedidos, ranking); qualquer
 * outro número cai no bot público (lib/whatsapp-public-bot.ts — atendimento
 * ao cliente, sem acesso a nada interno).
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

  const value = payload?.entry?.[0]?.changes?.[0]?.value;

  // Atualizações de status (enviada/entregue/lida) de mensagens NOSSAS —
  // chegam num payload separado do das mensagens recebidas.
  const statuses = value?.statuses as any[] | undefined;
  if (statuses?.length) {
    await Promise.all(
      statuses
        .filter((s) => typeof s?.id === "string" && typeof s?.status === "string")
        .map((s) => updateMessageStatus(s.id, s.status)),
    );
  }

  const messages = value?.messages as any[] | undefined;
  if (!messages?.length) return NextResponse.json({ ok: true });

  for (const msg of messages) {
    if (msg?.type !== "text" || typeof msg.text?.body !== "string") continue;
    const from = String(msg.from ?? "");

    try {
      const reply = isAuthorizedWhatsAppNumber(from)
        ? await handleWhatsAppMessage(msg.text.body, from)
        : await handlePublicMessage(msg.text.body, from);
      // null = conversa pausada (admin assumiu em /admin/conversas) — a
      // mensagem já foi registrada, só não responde por cima.
      if (reply) {
        const sent = await sendWhatsAppText(from, reply);
        if (sent.ok && sent.id) await attachWamid(from, sent.id);
      }
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
