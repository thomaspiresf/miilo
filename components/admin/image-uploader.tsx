"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from "lucide-react";
import {
  deleteImageAction,
  setImageColorAction,
  addImageUrlAction,
  reorderImagesAction,
} from "@/app/admin/actions";
import { uploadToStorage } from "@/lib/admin-upload";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/misc";
import type { ProductImage } from "@/lib/types";

const NONE = "__none__";
const MAX_MB = 10;

type Color = { name: string; hex: string | null };

export function ImageUploader({
  productId,
  images,
  colors,
}: {
  productId: string;
  images: ProductImage[];
  colors: Color[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const uploadColorRef = useRef<string>(NONE);

  const hasColors = colors.length > 0;

  // ordem local (otimista) enquanto casa com o conjunto do servidor
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const serverIds = images.map((i) => i.id);
  const effectiveOrder =
    localOrder &&
    localOrder.length === serverIds.length &&
    localOrder.every((id) => serverIds.includes(id))
      ? localOrder
      : serverIds;

  const byId = new Map(images.map((im) => [im.id, im] as const));
  const ordered = effectiveOrder
    .map((id) => byId.get(id))
    .filter((i): i is ProductImage => !!i);

  // agrupa por cor, na ordem: sem cor → cores (ordem das variações)
  const groupKeys = [NONE, ...colors.map((c) => c.name)];
  const groups: Record<string, ProductImage[]> = { [NONE]: [] };
  for (const c of colors) groups[c.name] = [];
  for (const im of ordered) {
    const key =
      im.color && groups[im.color] !== undefined ? im.color : NONE;
    groups[key].push(im);
  }

  function persistFromGroups(next: Record<string, ProductImage[]>) {
    const flat = groupKeys.flatMap((k) => next[k].map((im) => im.id));
    setLocalOrder(flat);
    reorderImagesAction(productId, flat).then(() => router.refresh());
  }

  function reorderWithin(key: string, from: number, to: number) {
    const arr = [...groups[key]];
    if (to < 0 || to >= arr.length) return;
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
    persistFromGroups({ ...groups, [key]: arr });
  }

  function makePrimary(key: string, id: string) {
    const arr = groups[key].filter((im) => im.id !== id);
    const it = groups[key].find((im) => im.id === id);
    if (!it) return;
    persistFromGroups({ ...groups, [key]: [it, ...arr] });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const color = uploadColorRef.current;
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
        if (color !== NONE) fd.append("color", color);
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

  function pickFiles(color: string) {
    uploadColorRef.current = color;
    inputRef.current?.click();
  }

  return (
    <div className="space-y-5">
      {groupKeys.map((key) => {
        const list = groups[key];
        const color = colors.find((c) => c.name === key);
        return (
          <div key={key}>
            <div className="mb-2 flex items-center gap-2">
              {key === NONE ? (
                <span className="text-sm font-bold">Sem cor específica</span>
              ) : (
                <>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: color?.hex ?? "#d4d4d8" }}
                  />
                  <span className="text-sm font-bold">{key}</span>
                </>
              )}
              <span className="text-xs text-muted">
                {key === NONE
                  ? "aparece quando as cores estão juntas / como fallback"
                  : `1ª foto = a que aparece na vitrine pra ${key}`}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {list.map((im, i) => (
                <div key={im.id} className="w-24">
                  <div className="relative">
                    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-black/5">
                      <Image src={im.url} alt="" fill sizes="96px" className="object-cover" unoptimized />
                      {i === 0 && (
                        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-[10px] font-semibold text-background">
                          principal
                        </span>
                      )}
                    </div>

                    <form
                      action={async (fd) => {
                        await deleteImageAction(fd);
                        router.refresh();
                      }}
                      className="absolute -right-2 -top-2 z-10"
                    >
                      <input type="hidden" name="imageId" value={im.id} />
                      <input type="hidden" name="productId" value={productId} />
                      <button
                        type="submit"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow"
                        aria-label="Remover imagem"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>

                  <div className="mt-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reorderWithin(key, i, i - 1)}
                      disabled={i === 0}
                      aria-label="Mover pra esquerda"
                      className="rounded border border-border p-1 text-muted disabled:opacity-30 hover:bg-black/5"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderWithin(key, i, i + 1)}
                      disabled={i === list.length - 1}
                      aria-label="Mover pra direita"
                      className="rounded border border-border p-1 text-muted disabled:opacity-30 hover:bg-black/5"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => makePrimary(key, im.id)}
                      disabled={i === 0}
                      aria-label="Tornar principal"
                      title="Tornar principal"
                      className={cn(
                        "ml-auto rounded border border-border p-1 hover:bg-black/5",
                        i === 0 ? "text-yellow-500" : "text-muted disabled:opacity-30",
                      )}
                    >
                      <Star className="h-3.5 w-3.5" fill={i === 0 ? "currentColor" : "none"} />
                    </button>
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
                        <option value="">Sem cor</option>
                        {colors.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </form>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => pickFiles(key)}
                disabled={busy > 0}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs font-semibold text-muted hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {busy > 0 ? <Spinner /> : <ImagePlus className="h-5 w-5" />}
                {busy > 0 ? "enviando…" : key === NONE ? "adicionar" : `foto ${key}`}
              </button>
            </div>
          </div>
        );
      })}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">
        JPG, PNG ou WebP até 10 MB. Use ◀ ▶ ou a estrela pra escolher qual foto
        representa cada cor na vitrine.
      </p>
    </div>
  );
}
