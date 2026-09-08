"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero "animação padrão": o coelho da miilo se esconde na toca conforme
 * a página rola pra baixo (e reaparece ao rolar pra cima).
 * viewBox 1080×1080 — mesmo do public/logo/icone-miilo.svg.
 */
const HOLE_Y = 850.6; // centro da toca no viewBox
const CLIP_Y = 884; // linha onde o coelho some (um pouco abaixo do centro)
const SINK_MAX = 760; // quanto o coelho desce (unidades do viewBox) até sumir

export function HeroRabbit() {
  const ref = useRef<HTMLDivElement>(null);
  const [sink, setSink] = useState(0); // 0 = pra fora · 1 = escondido

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // progresso: coelho já sumiu quando o hero rolou ~55% da própria altura
      const p = Math.min(1, Math.max(0, -r.top / (r.height * 0.55)));
      setSink(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-end justify-center overflow-hidden bg-sky"
    >
      <svg
        viewBox="0 0 1080 1080"
        preserveAspectRatio="xMidYMax meet"
        className="h-[112%] w-auto"
        role="img"
        aria-label="miilo — roupas e brinquedos infantis"
      >
        <defs>
          <clipPath id="miilo-hole">
            <rect x="0" y="0" width="1080" height={CLIP_Y} />
          </clipPath>
        </defs>

        {/* fundo da toca (metade de trás) */}
        <ellipse cx="539.9" cy={HOLE_Y} rx="475" ry="78.5" fill="#2c4fc9" />

        {/* coelho — cortado na linha da toca, desce conforme o scroll */}
        <g clipPath="url(#miilo-hole)">
          <g
            style={{
              transform: `translateY(${(sink * SINK_MAX).toFixed(1)}px)`,
              transition: "transform 140ms linear",
            }}
          >
            <path
              fill="#fff"
              d="M712.5,744.2c-3.4,20.5,1.7,50.8,6,68.3l18,75c1.2.4,1.8.7,1.8,1.1-19.8,1.5-40.3,2.8-61.5,3.9h-.3c-43.3,2.2-89.1,3.3-136.6,3.3-70.6,0-137.7-2.5-197.9-7.1-.2,0-.3,0-.5,0-2.4-.2-4.7-.3-7.1-.5-.1,0-.2,0-.2,0-.9-.1-1.2-.3-.9-.4l15.7-79c4.2-21,5.9-42.1,5.7-63.3v-.2c-.2-9.7-2.9-17-6.8-25.5-47.4-103-77.2-212.4-89.5-325.4-7.4-68.2-5.4-176.6,46.3-223.2,16.3-14.7,37.7-22.2,59.4-17.4,43.5,9.7,65.5,56,74,98.1,14.1,69.5,9.4,148.7,4.5,220.5-5,73.5-9.6,145.1-10.7,218.9,5.1,7.2,15.7,11.6,24.8,9.6,49.6-11.1,99.6-11.3,149.1.8,2.5.6,8.7.4,10.1-1.4,5.5-6.8,13.7-31.4,15.7-45.5,5.8-43.1,10.3-85.2,12.7-128.7l6.6-121.9c3.1-56.5,12.7-127.7,34-179.1,9.1-21.9,21.8-41.8,39.9-56.4,28.6-23,66.5-21.7,93.7,2.4,58,51.3,42.5,174.3,26.8,247.7-23.4,109.7-65,213.5-124.8,307.8-4.2,3.8-6.7,10.1-7.9,17.8Z"
            />
            <path
              fill="#2c4fc9"
              d="M474.5,859.8c-2.9,4.7-8.7,7.9-13.1,8-4.7,0-10.8-3.1-14.2-7.5-10-12.8-10.1-31-.9-44.6,2.7-4,9.3-6.6,13.7-6.5,4.2,0,10.4,3,13.2,6.9,9.1,13,10.1,29.7,1.3,43.7Z"
            />
            <path
              fill="#2c4fc9"
              d="M608.1,816c15.3,21.9,3.2,50-8.5,51-3.7.3-9.2-2-12.1-5.6-11.8-14.5-11.7-38.4,3.2-51,4.6-3.9,14.4,1.3,17.4,5.6Z"
            />
          </g>
        </g>

        {/* borda da frente da toca — coelho some por trás dela */}
        <path d="M64.9,850.6a475,78.5 0 0 0 950,0Z" fill="#2c4fc9" />
      </svg>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-white/90 sm:bottom-7 sm:text-sm">
        roupas e brinquedos infantis
      </p>
    </div>
  );
}
