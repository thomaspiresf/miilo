import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { adminListProducts } from "@/lib/data/admin";
import { getPricingSettings } from "@/lib/data/pricing";
import { suggestForContribution } from "@/lib/pricing-math";
import { invoiceAiConfigured, scanInvoice } from "@/lib/invoice-ai";
import { findMatch, type ExistingProduct, type ScanItemResult, type ScanResponse } from "@/lib/invoice-types";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Lê a nota de compra (foto ou PDF) com IA e devolve os itens já com preço de venda sugerido
 * (Precificação) e o produto parecido que já existe, se houver. Nada é salvo aqui — quem confirma
 * o cadastro é a pessoa, na tela de revisão.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`invoice-scan:${clientIp(request)}`, 15, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie a foto ou o PDF da nota." }, { status: 400 });
  if (!TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Use foto (JPG, PNG, WebP) ou PDF." }, { status: 422 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo muito grande (máx. 10 MB)." }, { status: 422 });

  if (!invoiceAiConfigured()) {
    const body: ScanResponse = {
      items: [],
      supplier: null,
      invoiceDate: null,
      aiAvailable: false,
      message: "A leitura automática não está configurada neste ambiente — adicione os itens na mão.",
    };
    return NextResponse.json(body);
  }

  const scan = await scanInvoice(Buffer.from(await file.arrayBuffer()), file.type);
  if (!scan || scan.items.length === 0) {
    const body: ScanResponse = {
      items: [],
      supplier: scan?.supplier ?? null,
      invoiceDate: scan?.invoiceDate ?? null,
      aiAvailable: true,
      message: "Não consegui ler itens nessa nota. Tente uma foto mais nítida ou adicione os itens na mão.",
    };
    return NextResponse.json(body);
  }

  const [products, settings] = await Promise.all([adminListProducts(), getPricingSettings()]);
  const existing: ExistingProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: [v.size, v.color].filter(Boolean).join(" · ") || "Único",
      size: v.size,
      stock: v.stock,
    })),
  }));

  const items: ScanItemResult[] = scan.items.map((it) => ({
    ...it,
    suggestedPrice: suggestForContribution(it.unitCost, settings, settings.targetMarginPercent),
    match: findMatch(it, existing),
  }));
  const body: ScanResponse = { items, supplier: scan.supplier, invoiceDate: scan.invoiceDate, aiAvailable: true };
  return NextResponse.json(body);
}
