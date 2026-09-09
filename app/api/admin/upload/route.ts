import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminUploadImage, adminUploadVideo } from "@/lib/data/admin";
import { isSameOrigin, forbiddenCrossOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenCrossOrigin();
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const productId = String(form?.get("productId") ?? "");
  const kind = String(form?.get("kind") ?? "image");
  const color = String(form?.get("color") ?? "").trim() || null;

  if (!(file instanceof File) || !productId) {
    return NextResponse.json({ error: "Envie um arquivo e o productId." }, { status: 400 });
  }

  try {
    const { url } =
      kind === "video"
        ? await adminUploadVideo(productId, file)
        : await adminUploadImage(productId, file, color);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha no upload" },
      { status: 422 },
    );
  }
}
