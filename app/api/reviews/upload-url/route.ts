import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdmin } from "@/lib/env";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";

const BUCKET = "product-images";
const EXT = ["jpg", "jpeg", "png", "webp", "avif"];

/** URL assinada pra subir uma foto de avaliação (só cliente logado). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  const rl = rateLimit(`reviewup:${clientIp(request)}`, 30, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "Indisponível." }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const rawExt = String(body?.ext ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = EXT.includes(rawExt) ? rawExt : "jpg";
  const path = `reviews/${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ path: data.path, token: data.token });
}
