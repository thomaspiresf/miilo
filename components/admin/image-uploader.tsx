"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { deleteImageAction } from "@/app/admin/actions";
import { Spinner } from "@/components/ui/misc";
import type { ProductImage } from "@/lib/types";

export function ImageUploader({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy((n) => n + files.length);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha no upload");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no upload");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((im) => (
          <div key={im.id} className="relative">
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-black/5">
              <Image src={im.url} alt="" fill sizes="96px" className="object-cover" unoptimized />
            </div>
            <form
              action={async (fd) => {
                await deleteImageAction(fd);
                router.refresh();
              }}
              className="absolute -right-2 -top-2"
            >
              <input type="hidden" name="imageId" value={im.id} />
              <input type="hidden" name="productId" value={productId} />
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy > 0}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs font-semibold text-muted hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy > 0 ? <Spinner /> : <ImagePlus className="h-5 w-5" />}
          {busy > 0 ? "enviando…" : "adicionar"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        JPG, PNG ou WebP até 6 MB. A primeira imagem é a principal.
      </p>
    </div>
  );
}
