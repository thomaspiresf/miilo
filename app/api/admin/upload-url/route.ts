import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";

const BUCKET = "product-images";
const IMG_EXT = ["jpg", "jpeg", "png", "webp", "avif"];
const VID_EXT = ["mp4", "webm", "mov"];

/**
 * Devolve uma URL assinada pra subir o arquivo DIRETO no Supabase Storage,
 * sem passar pela função da Vercel (que limita o corpo a ~4,5 MB).
 */
export async function POST(request: Request) {
  await requireAdmin();

  if (!hasSupabaseAdmin()) {
    return NextResponse.json(
      { error: "Upload de arquivo exige o Supabase configurado. Use 'adicionar por URL'." },
      { status: 422 },
    );
  }

  const body = await request.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  const kind = body?.kind === "video" ? "video" : "image";
  const rawExt = String(body?.ext ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!productId) {
    return NextResponse.json({ error: "productId obrigatório" }, { status: 400 });
  }

  const allowed = kind === "video" ? VID_EXT : IMG_EXT;
  const ext = allowed.includes(rawExt) ? rawExt : allowed[0];
  const prefix = kind === "video" ? "video-" : "";
  const path = `${productId}/${prefix}${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
