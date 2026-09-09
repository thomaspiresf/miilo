"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Check, Loader2, Star, X } from "lucide-react";
import type { ReviewableProduct } from "@/lib/data/reviews";
import { createClient } from "@/lib/supabase/client";
import { submitReviewAction } from "@/app/(loja)/conta/pedidos/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Photo = { path: string; url: string };
type State = { rating: number; comment: string; photos: Photo[] };

async function uploadPhoto(file: File): Promise<Photo> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const res = await fetch("/api/reviews/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ext }),
  });
  const sig = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(sig.error || "Falha no upload");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("product-images")
    .uploadToSignedUrl(sig.path, sig.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("product-images").getPublicUrl(sig.path);
  return { path: sig.path, url: data.publicUrl };
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-7 w-7 transition",
              (hover || value) >= n ? "fill-yellow text-yellow" : "text-border",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function OrderReview({
  orderId,
  products,
}: {
  orderId: string;
  products: ReviewableProduct[];
}) {
  const allReviewed = products.length > 0 && products.every((p) => p.review);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(allReviewed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, State>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.productId,
        {
          rating: p.review?.rating ?? 0,
          comment: p.review?.comment ?? "",
          photos: (p.review?.photos ?? []).map((url) => ({ path: url, url })),
        },
      ]),
    ),
  );

  if (products.length === 0) return null;

  function set(id: string, patch: Partial<State>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  async function addPhotos(id: string, files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const cur = state[id].photos;
    const room = 6 - cur.length;
    try {
      const uploaded = await Promise.all(
        [...files].slice(0, room).map((f) => uploadPhoto(f)),
      );
      set(id, { photos: [...cur, ...uploaded] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar a foto");
    }
  }

  async function submit() {
    const items = products
      .map((p) => ({ productId: p.productId, ...state[p.productId] }))
      .filter((i) => i.rating >= 1)
      .map((i) => ({
        productId: i.productId,
        rating: i.rating,
        comment: i.comment || null,
        photos: i.photos.map((ph) => ph.path),
      }));
    if (items.length === 0) {
      setError("Dê pelo menos uma nota (as estrelas) para enviar.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await submitReviewAction({ orderId, items });
    setSaving(false);
    if ("error" in res) setError(res.error);
    else {
      setDone(true);
      setOpen(false);
    }
  }

  if (done && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success"
      >
        <Check className="h-4 w-4" /> Compra avaliada — editar
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]"
      >
        <Star className="h-3.5 w-3.5" /> Avaliar esta compra
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-border bg-background p-3">
      {products.map((p) => {
        const st = state[p.productId];
        return (
          <div key={p.productId} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5">
                {p.imageUrl && (
                  <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                {p.variantLabels.length > 0 && (
                  <p className="truncate text-[11px] text-muted">
                    {p.variantLabels.join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <StarPicker
              value={st.rating}
              onChange={(n) => set(p.productId, { rating: n })}
            />

            <textarea
              value={st.comment}
              onChange={(e) => set(p.productId, { comment: e.target.value })}
              placeholder="Conte como foi (opcional)"
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
            />

            <div className="flex flex-wrap items-center gap-2">
              {st.photos.map((ph, i) => (
                <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border border-border">
                  <Image src={ph.url} alt="" fill sizes="56px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      set(p.productId, {
                        photos: st.photos.filter((_, j) => j !== i),
                      })
                    }
                    className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-foreground/80 text-background"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {st.photos.length < 6 && (
                <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted hover:bg-black/[0.03]">
                  <Camera className="h-4 w-4" />
                  <span className="mt-0.5 text-[9px]">foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addPhotos(p.productId, e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
