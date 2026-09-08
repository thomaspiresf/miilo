"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { deleteImageAction, setImageColorAction, addImageUrlAction } from "@/app/admin/actions";
import { uploadToStorage } from "@/lib/admin-upload";
import { Spinner } from "@/components/ui/misc";
import type { ProductImage } from "@/lib/types";

const ALL = "__all__";
const MAX_MB = 10;

export function ImageUploader({
  productId,
  images,
  colors,
}: {
  productId: string;
  images: ProductImage[];
  colors: string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadColor, setUploadColor] = useState<string>(ALL);

  const hasColors = colors.length > 0;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy((n) => n + files.length);
    for (const file of Array.from(files)) {
      try {
        if (file.size > MAX_MB * 1024 * 1024) {
          throw new Error(`"${file.name}" passa de ${MAX_MB} MB. Reduza a imagem.`);
        }
        const path = await uploadToStorage(file, { productId, kind: "image" });
        const fd = new FormData();
        fd.append("productId", productId);
        fd.append("url", path);
        if (uploadColor !== ALL) fd.append("color", uploadColor);
        await addImageUrlAction(fd);
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
      {hasColors && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-semibold">Atrelar novas fotos a:</span>
          <select
            value={uploadColor}
            onChange={(e) => setUploadColor(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
          >
            <option value={ALL}>Todas as cores</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap gap-3">
        {images.map((im) => (
          <div key={im.id} className="w-24">
            <div className="relative">
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

            {hasColors && (
              <form
                action={async (fd) => {
                  await setImageColorAction(fd);
                  router.refresh();
                }}
                className="mt-1"
              >
                <input type="hidden" name="imageId" value={im.id} />
                <input type="hidden" name="productId" value={productId} />
                <select
                  name="color"
                  defaultValue={im.color ?? ""}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="h-8 w-24 rounded-lg border border-border bg-surface px-1 text-xs"
                >
                  <option value="">Todas</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </form>
            )}
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
        JPG, PNG ou WebP até 6 MB. A primeira imagem “Todas” é a principal.
        {hasColors && " Fotos atreladas a uma cor aparecem quando o cliente seleciona aquela cor."}
      </p>
    </div>
  );
}
