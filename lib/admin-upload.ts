"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "product-images";

/**
 * Sobe um arquivo DIRETO no Supabase Storage via URL assinada — sem passar
 * pela função da Vercel (que limita o corpo a ~4,5 MB). Devolve o path no bucket.
 */
export async function uploadToStorage(
  file: File,
  opts: { productId: string; kind: "image" | "video" },
): Promise<string> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  const res = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: opts.productId, kind: opts.kind, ext }),
  });
  const sig = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(sig.error || "Falha ao preparar o upload");

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(sig.path, sig.token, file, { contentType: file.type });
  if (error) throw new Error(error.message || "Falha no upload");

  return sig.path as string;
}
