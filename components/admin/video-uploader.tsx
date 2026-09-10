"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, X } from "lucide-react";
import {
  setProductVideoAction,
  setProductVideoAudioAction,
} from "@/app/admin/actions";
import { parseVideo } from "@/lib/video";
import { uploadToStorage } from "@/lib/admin-upload";
import { cn } from "@/lib/utils";
import type { VideoAudio } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

const MAX_MB = 50;

const AUDIO_OPTIONS: { value: VideoAudio; label: string; help: string }[] = [
  {
    value: "muted",
    label: "Sem som",
    help: "Toca mudo em loop. O cliente não consegue ativar o som.",
  },
  {
    value: "optional",
    label: "Sem som, cliente ativa",
    help: "Começa mudo em loop; o cliente pode ativar o som pelos controles.",
  },
  {
    value: "on",
    label: "Com som",
    help: "O cliente dá play e ouve o áudio do vídeo desde o início.",
  },
];

export function VideoUploader({
  productId,
  video,
  audio: audioInitial,
}: {
  productId: string;
  video: string | null;
  audio: VideoAudio;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  const [audio, setAudio] = useState<VideoAudio>(audioInitial);
  const [savingAudio, startAudio] = useTransition();

  function chooseAudio(next: VideoAudio) {
    if (next === audio) return;
    const prev = audio;
    setAudio(next);
    setError(null);
    startAudio(async () => {
      const res = await setProductVideoAudioAction(productId, next);
      if (res?.error) {
        setAudio(prev);
        setError(res.error);
      }
    });
  }

  const muted = audio !== "on";

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
            <video src={parsed.src} controls muted={muted} className="aspect-video w-full" />
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

        {/* áudio do vídeo */}
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            Áudio na página do produto
            {savingAudio && <Spinner className="h-3 w-3" />}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AUDIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={audio === opt.value}
                disabled={savingAudio}
                onClick={() => chooseAudio(opt.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                  audio === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-black/5",
                  savingAudio && "opacity-60",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {AUDIO_OPTIONS.find((o) => o.value === audio)?.help}
          </p>
          {parsed.kind !== "file" && (
            <p className="mt-1 text-xs text-muted">
              Em links do YouTube/Vimeo o controle de som depende do player deles.
            </p>
          )}
        </div>
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
