"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import type { ProductImage } from "@/lib/types";
import { parseVideo, embedSrc } from "@/lib/video";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
  video,
  videoMuted = true,
}: {
  images: ProductImage[];
  name: string;
  video?: string | null;
  videoMuted?: boolean;
}) {
  const parsedVideo = parseVideo(video);
  // slides: 1ª foto, depois o vídeo (se houver), depois as demais fotos
  const slides = [
    ...(images[0] ? [{ type: "image" as const, key: images[0].id, im: images[0] }] : []),
    ...(parsedVideo ? [{ type: "video" as const, key: "video" }] : []),
    ...images.slice(1).map((im) => ({ type: "image" as const, key: im.id, im })),
  ];

  const [active, setActive] = useState(0);

  if (slides.length === 0) {
    return <div className="aspect-square w-full rounded-2xl bg-black/5" />;
  }

  const current = slides[Math.min(active, slides.length - 1)];

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/5">
        {current.type === "video" && parsedVideo ? (
          parsedVideo.kind === "file" ? (
            <video
              src={parsedVideo.src}
              controls
              playsInline
              muted={videoMuted}
              autoPlay={videoMuted}
              loop={videoMuted}
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <iframe
              src={embedSrc(parsedVideo, videoMuted)}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              title={`Vídeo — ${name}`}
            />
          )
        ) : current.type === "image" ? (
          <Image
            src={current.im.url}
            alt={current.im.alt ?? name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
          />
        ) : null}
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2",
                i === active ? "border-primary" : "border-transparent",
              )}
            >
              {s.type === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-foreground/90 text-background">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              ) : (
                <Image src={s.im.url} alt="" fill sizes="64px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
