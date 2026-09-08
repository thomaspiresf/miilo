"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

type Slide = {
  bg: string;
  content: React.ReactNode;
  href?: string;
};

const slides: Slide[] = [
  {
    bg: "bg-sky",
    href: "/c/roupas",
    content: (
      <div className="flex h-full items-center justify-center">
        <Logo variant="horizontal" tone="negativo" className="h-12 w-auto sm:h-16" priority />
      </div>
    ),
  },
  {
    bg: "bg-pink",
    href: "/c/bodies",
    content: (
      <div className="flex h-full flex-col justify-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">novidade</p>
        <p className="mt-1 max-w-xs text-2xl font-black leading-tight text-white sm:text-3xl">
          Bodies em algodão pima, do RN ao G.
        </p>
      </div>
    ),
  },
  {
    bg: "bg-accent",
    content: (
      <div className="flex h-full flex-col justify-center">
        <p className="text-2xl font-black leading-tight text-white sm:text-3xl">
          Frete grátis acima de R$ 299
        </p>
        <p className="mt-1 text-white/80">para todo o Brasil, no PAC.</p>
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
    <div className={cn("h-44 rounded-3xl px-6 py-5 sm:h-56 sm:px-10", slide.bg)}>
      {slide.content}
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
