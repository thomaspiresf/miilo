"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

type Slide = {
  /** cor de fundo (usada quando não há imagem) */
  bg: string;
  /** imagem 1920×1080 (16:9) — caminho em /public ou URL pública */
  image?: string;
  content: React.ReactNode;
  href?: string;
};

const slides: Slide[] = [
  {
    bg: "bg-sky",
    href: "/c/roupas",
    content: (
      <div className="flex h-full items-center justify-center">
        <Logo variant="horizontal" tone="negativo" className="h-14 w-auto sm:h-24" priority />
      </div>
    ),
  },
  {
    bg: "bg-pink",
    href: "/c/bodies",
    content: (
      <div className="flex h-full flex-col justify-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">novidade</p>
        <p className="mt-1 max-w-md text-2xl font-black leading-tight text-white sm:text-4xl">
          Bodies em algodão pima, do RN ao G.
        </p>
      </div>
    ),
  },
  {
    bg: "bg-accent",
    content: (
      <div className="flex h-full flex-col justify-center">
        <p className="text-2xl font-black leading-tight text-white sm:text-4xl">
          Frete grátis acima de R$ 299
        </p>
        <p className="mt-1 text-white/80 sm:text-lg">para todo o Brasil, no PAC.</p>
      </div>
    ),
  },
];

export function HeroBanner() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);

  const slide = slides[i];
  const inner = (
    <div
      className={cn(
        "relative aspect-[16/9] w-full overflow-hidden rounded-3xl",
        !slide.image && slide.bg,
      )}
    >
      {slide.image && (
        <>
          <Image
            src={slide.image}
            alt=""
            fill
            priority
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="object-cover"
          />
          {/* leve escurecida pra deixar o texto legível */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
        </>
      )}
      <div className="relative h-full px-6 py-6 sm:px-12 sm:py-10">{slide.content}</div>
    </div>
  );

  return (
    <section>
      {slide.href ? <Link href={slide.href}>{inner}</Link> : inner}
      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === i ? "w-5 bg-foreground" : "w-1.5 bg-border",
            )}
          />
        ))}
      </div>
    </section>
  );
}
