"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, X } from "lucide-react";
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

  // ordem local (otimista) — só é usada enquanto casa com o conjunto do servidor
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const serverIds = images.map((i) => i.id);
  const effectiveOrder =
    localOrder &&
    localOrder.length === serverIds.length &&
    localOrder.every((id) => serverIds.includes(id))
      ? localOrder
      : serverIds;

  const ordered = effectiveOrder
    .map((id) => images.find((i) => i.id === id))
    .filter((i): i is ProductImage => !!i);

  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function persist(next: string[]) {
    setLocalOrder(next);
    reorderImagesAction(productId, next).then(() => router.refresh());
  }

  function move(id: string, dir: -1 | 1) {
    const cur = [...effectiveOrder];
    const from = cur.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= cur.length) return;
    [cur[from], cur[to]] = [cur[to], cur[from]];
    persist(cur);
  }

  function drop(targetId: string) {
    const src = dragIdRef.current;
    dragIdRef.current = null;
    setDraggingId(null);
    setOverId(null);
    if (!src || src === targetId) return;
    const next = [...effectiveOrder];
    const from = next.indexOf(src);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, src);
    persist(next);
  }

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
        {ordered.map((im, i) => (
          <div
            key={im.id}
            className="w-24"
            onDragOver={(e) => {
              e.preventDefault();
              if (overId !== im.id) setOverId(im.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(im.id);
            }}
          >
            <div className="relative">
              <div
                draggable
                onDragStart={(e) => {
                  dragIdRef.current = im.id;
                  setDraggingId(im.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragIdRef.current = null;
                  setDraggingId(null);
                  setOverId(null);
                }}
                className={cn(
                  "relative h-24 w-24 cursor-grab overflow-hidden rounded-lg border border-border bg-black/5 active:cursor-grabbing",
                  draggingId === im.id && "opacity-40",
                  overId === im.id && "ring-2 ring-primary ring-offset-1",
                )}
              >
                <Image src={im.url} alt="" fill sizes="96px" className="object-cover" unoptimized />
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-foreground/70 py-0.5 text-center text-[10px] font-semibold text-background">
                    principal
                  </span>
                )}
                <GripVertical className="pointer-events-none absolute left-1 top-1 h-4 w-4 text-white/90 drop-shadow" />
              </div>

              {/* botão remover — FORA do elemento draggable, pra não conflitar com o toque */}
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

            {ordered.length > 1 && (
              <div className="mt-1 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(im.id, -1)}
                  disabled={i === 0}
                  aria-label="Mover pra esquerda"
                  className="rounded border border-border p-1 text-muted disabled:opacity-30 hover:bg-black/5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(im.id, 1)}
                  disabled={i === ordered.length - 1}
                  aria-label="Mover pra direita"
                  className="rounded border border-border p-1 text-muted disabled:opacity-30 hover:bg-black/5"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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
        JPG, PNG ou WebP até 10 MB. Arraste as fotos pra reordenar — a primeira é a principal.
        {hasColors && " Fotos atreladas a uma cor aparecem quando o cliente seleciona aquela cor."}
      </p>
    </div>
  );
}
