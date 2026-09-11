import "server-only";
import { MercadoPagoConfig, Payment, WebhookSignatureValidator } from "mercadopago";
import { env, paymentsMocked } from "@/lib/env";

export type BrickFormData = {
  token?: string;
  issuer_id?: string;
  payment_method_id: string;
  transaction_amount?: number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

export type PaymentResult = {
  id: string;
  status: string; // approved | pending | in_process | rejected | ...
  status_detail: string;
  payment_method_id: string;
  external_reference?: string | null;
  /** dados do Pix quando aplicável */
  pix?: {
    qr_code: string;
    qr_code_base64: string;
    ticket_url?: string;
  };
  /**
   * Valor que efetivamente cai na conta, já descontada a taxa do Mercado Pago
   * (`transaction_details.net_received_amount`, com fallback pra soma de
   * `fee_details`). Null quando o MP ainda não informou esse valor.
   */
  netReceivedAmount?: number | null;
};

function mpClient() {
  return new Payment(new MercadoPagoConfig({ accessToken: env.mercadopago.accessToken }));
}

/**
 * Cria o pagamento no Mercado Pago a partir do payload do Payment Brick.
 * O valor é SEMPRE o total do pedido calculado no servidor — nunca o do cliente.
 */
export async function createPayment(params: {
  orderId: string;
  orderNumber: string;
  amount: number;
  payerEmail: string;
  form: BrickFormData;
}): Promise<PaymentResult> {
  const { orderId, orderNumber, amount, payerEmail, form } = params;

  if (paymentsMocked()) return mockPayment(amount, form);

  const isPix = form.payment_method_id === "pix";
  const idempotencyKey = `order-${orderId}`;

  // O Pix expira em 1h — o mesmo tempo que o estoque fica reservado. Assim o
  // cliente não consegue pagar depois que a reserva já foi devolvida.
  // O MP exige offset de fuso explícito (não aceita o "Z" do toISOString()).
  const pixExpiresAt = new Date(Date.now() + 60 * 60_000)
    .toISOString()
    .replace("Z", "+00:00");

  // O MP só aceita notification_url pública e https (não funciona em localhost).
  const notificationUrl =
    env.site.url.startsWith("https://") && !env.site.url.includes("localhost")
      ? `${env.site.url}/api/webhooks/mercadopago`
      : undefined;

  const res = await mpClient().create({
    body: {
      transaction_amount: amount,
      description: `Pedido ${orderNumber}`,
      external_reference: orderId,
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      metadata: { order_id: orderId },
      payment_method_id: form.payment_method_id,
      ...(isPix
        ? { date_of_expiration: pixExpiresAt }
        : {
            token: form.token,
            installments: form.installments ?? 1,
            issuer_id: form.issuer_id ? Number(form.issuer_id) : undefined,
          }),
      payer: {
        email: form.payer?.email || payerEmail,
        ...(form.payer?.identification?.number
          ? { identification: form.payer.identification }
          : {}),
      },
    },
    requestOptions: { idempotencyKey },
  });

  return normalize(res);
}

export async function getPayment(id: string): Promise<PaymentResult> {
  if (paymentsMocked()) {
    return {
      id,
      status: "approved",
      status_detail: "accredited",
      payment_method_id: "mock",
    };
  }
  const res = await mpClient().get({ id });
  return normalize(res);
}

/** Lança InvalidWebhookSignatureError se a assinatura não bater. */
export function assertValidWebhook(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}) {
  if (paymentsMocked() || !env.mercadopago.webhookSecret) return; // sem segredo configurado
  WebhookSignatureValidator.validate({
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    dataId: input.dataId,
    secret: env.mercadopago.webhookSecret,
    toleranceSeconds: 300,
  });
}

// --------------------------------------------------------------------------
//  Mock
// --------------------------------------------------------------------------
function mockPayment(amount: number, form: BrickFormData): PaymentResult {
  const id = `MOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  if (form.payment_method_id === "pix") {
    const fakeCode =
      "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540" +
      amount.toFixed(2) +
      "5802BR5909miilo LTDA6009SAO PAULO62070503***6304ABCD";
    return {
      id,
      status: "pending",
      status_detail: "pending_waiting_transfer",
      payment_method_id: "pix",
      pix: {
        qr_code: fakeCode,
        qr_code_base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    };
  }
  // cartão de crédito/débito -> aprovado
  return {
    id,
    status: "approved",
    status_detail: "accredited",
    payment_method_id: form.payment_method_id || "master",
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(res: any): PaymentResult {
  const pi = res?.point_of_interaction?.transaction_data;
  return {
    id: String(res.id),
    status: res.status,
    status_detail: res.status_detail,
    payment_method_id: res.payment_method_id,
    external_reference: res.external_reference ?? null,
    pix: pi?.qr_code
      ? {
          qr_code: pi.qr_code,
          qr_code_base64: pi.qr_code_base64,
          ticket_url: pi.ticket_url,
        }
      : undefined,
    netReceivedAmount: netReceivedAmount(res),
  };
}

/**
 * O que efetivamente cai na conta: `transaction_details.net_received_amount`
 * quando o MP já informou (fonte mais confiável); senão, valor menos a soma
 * de `fee_details`. Sem nenhum dos dois, retorna null (trata como = total).
 */
function netReceivedAmount(res: any): number | null {
  const fromDetails = res?.transaction_details?.net_received_amount;
  if (fromDetails != null) return Number(fromDetails);

  const fees = res?.fee_details;
  if (Array.isArray(fees) && fees.length && res?.transaction_amount != null) {
    const totalFees = fees.reduce((s: number, f: any) => s + Number(f?.amount ?? 0), 0);
    return Number(res.transaction_amount) - totalFees;
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
