import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminUploadImage } from "@/lib/data/admin";

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const productId = String(form?.get("productId") ?? "");

  if (!(file instanceof File) || !productId) {
    return NextResponse.json({ error: "Envie um arquivo e o productId." }, { status: 400 });
  }

  try {
    const { url } = await adminUploadImage(productId, file);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha no upload" },
      { status: 422 },
    );
  }
}
