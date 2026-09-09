import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteShipping } from "@/lib/melhorenvio";
import { onlyDigits } from "@/lib/utils";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";

const schema = z.object({
  cep: z.string(),
  items: z
    .array(
      z.object({
        qty: z.number().int().positive(),
        weightGrams: z.number().positive().default(300),
        unitPrice: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`ship:${clientIp(request)}`, 60, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const cep = onlyDigits(parsed.data.cep);
  if (cep.length !== 8) {
    return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  }

  try {
    const options = await quoteShipping({ toCep: cep, items: parsed.data.items });
    return NextResponse.json({ options });
  } catch (err) {
    console.error("shipping quote error", err);
    return NextResponse.json(
      { error: "Não foi possível calcular o frete agora." },
      { status: 502 },
    );
  }
}
