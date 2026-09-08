"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, X } from "lucide-react";
import { setProductVideoAction } from "@/app/admin/actions";
import { parseVideo } from "@/lib/video";
import { uploadToStorage } from "@/lib/admin-upload";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

const MAX_MB = 50;

export function VideoUploader({
  productId,
  video,
}: {
  productId: string;
  video: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  const parsed = parseVideo(video);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Vídeo muito grande (máx. ${MAX_MB} MB). Deixe o clipe curto ou use um link do YouTube/Vimeo.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadToStorage(file, { productId, kind: "video" });
      const fd = new FormData();
      fd.append("productId", productId);
      fd.append("value", path);
      await setProductVideoAction(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  async function submit(value: string | null) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("productId", productId);
    if (value) fd.append("value", value);
    await setProductVideoAction(fd);
    setBusy(false);
    setLink("");
    router.refresh();
  }

  if (parsed) {
    return (
      <div className="space-y-3">
        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-black/5">
          {parsed.kind === "file" ? (
            <video src={parsed.src} controls className="aspect-video w-full" />
          ) : (
            <iframe
              src={parsed.src}
              className="aspect-video w-full"
              allow="fullscreen; picture-in-picture"
              title="Vídeo do produto"
            />
          )}
        </div>
        <p className="text-xs text-muted">
          {parsed.kind === "file" ? "Arquivo enviado" : `Link do ${parsed.kind === "youtube" ? "YouTube" : "Vimeo"}`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => submit(null)}
        >
          {busy ? <Spinner /> : <><X className="h-4 w-4" /> Remover vídeo</>}
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Spinner /> : <><Film className="h-4 w-4" /> Enviar vídeo</>}
        </Button>
        <span className="text-xs text-muted">MP4, WebM ou MOV até 50 MB — deixe curto (até ~1 min).</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="ou cole um link do YouTube / Vimeo"
          className="h-10 min-w-56 flex-1 rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !link.trim()}
          onClick={() => submit(link.trim())}
        >
          Anexar link
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => uploadFile(e.target.files?.[0])}
      />

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
