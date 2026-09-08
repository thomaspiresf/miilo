"use client";

import { useState } from "react";

/** Texto do cliente: preserva quebras de linha e parágrafos (não vira texto corrido). */
export function ExpandableText({ text, clamp = 320 }: { text: string; clamp?: number }) {
  const [open, setOpen] = useState(false);
  const full = text.replace(/\r\n?/g, "\n");
  const isLong = full.length > clamp;
  const shown = open || !isLong ? full : full.slice(0, clamp).trimEnd() + "…";

  const paragraphs = shown
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
          {i === paragraphs.length - 1 && isLong && (
            <>
              {" "}
              <button
                onClick={() => setOpen((v) => !v)}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                {open ? "Ler menos" : "Continuar lendo"}
              </button>
            </>
          )}
        </p>
      ))}
    </div>
  );
}
