import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { RECEIPT_TYPES, uploadReceipt } from "@/lib/data/expenses";
import { scanReceipt } from "@/lib/receipt-ai";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Recebe a foto de uma nota, guarda no bucket privado e pede pro Claude ler
 * os campos do gasto. A tela só PREENCHE o formulário com o resultado — quem
 * confirma o lançamento é a pessoa (valor lido por IA pode errar).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`expense-scan:${clientIp(request)}`, 20, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie a foto da nota." }, { status: 400 });
  }
  if (!RECEIPT_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Use JPG, PNG ou WebP." }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 8 MB)." }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const path = await uploadReceipt(bytes, file.type);
    const scan = await scanReceipt(bytes, file.type);
    return NextResponse.json({ path, scan });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao enviar a nota." },
      { status: 500 },
    );
  }
}
