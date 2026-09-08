"use client";

import { useState } from "react";

export function ExpandableText({ text, clamp = 240 }: { text: string; clamp?: number }) {
  const [open, setOpen] = useState(false);
  const isLong = text.length > clamp;
  const shown = open || !isLong ? text : text.slice(0, clamp).trimEnd() + "…";

  return (
    <p className="text-sm leading-relaxed text-muted">
      {shown}{" "}
      {isLong && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-semibold text-foreground underline underline-offset-2"
        >
          {open ? "Ler menos" : "Continuar lendo"}
        </button>
      )}
    </p>
  );
}
