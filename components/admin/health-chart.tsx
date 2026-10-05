"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HealthMonth = {
  ym: string; // YYYY-MM
  inn: number; // recebido
  out: number; // gasto
  cum: number; // resultado acumulado (recebido − gasto) desde o começo, até o fim deste mês
  /** o mês está dentro do período filtrado */
  active: boolean;
};

type View = "flow" | "result" | "cum";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "flow", label: "Entrou × saiu", hint: "Quanto recebeu e quanto gastou em cada mês." },
  { id: "result", label: "Resultado", hint: "Recebido menos gasto em cada mês: verde sobrou, vermelho faltou." },
  { id: "cum", label: "Acumulado", hint: "Quanto a loja já recuperou do que investiu, somando todos os meses até aqui." },
];

const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const longLabel = (ym: string) => {
  const s = `${MONTHS_LONG[Number(ym.slice(5)) - 1]} de ${ym.slice(0, 4)}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "2,3 mil" / "480" — compacto, para eixo e rótulos. */
function compact(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1000) return `${sign}${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}${Math.round(a)}`;
}

/** Passo "redondo" (1, 2, 5 × 10^k) para as linhas de grade. */
function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

const HEIGHT = 250;
const PAD = { top: 22, right: 10, bottom: 34, left: 40 };

/** `hrefBase` + "AAAA-MM" = link que filtra a página por aquele mês (string, pois este é um componente de cliente). */
export function HealthChart({ months, hrefBase }: { months: HealthMonth[]; hrefBase: string }) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [view, setView] = useState<View>("flow");
  // mês lido no painel: o último dentro do filtro (ou o mais recente), até o usuário passar o mouse/tocar em outro
  const defaultYm = [...months].reverse().find((m) => m.active)?.ym ?? months[months.length - 1]?.ym;
  const [picked, setPicked] = useState<string | null>(null);

  // largura real do contêiner: o texto do SVG fica em tamanho legível também no celular
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (months.length === 0) return null;

  const selectedYm = picked && months.some((m) => m.ym === picked) ? picked : defaultYm;
  const sel = months.find((m) => m.ym === selectedYm) ?? months[months.length - 1];
  const narrow = width < 440;

  // valor plotado de cada mês, conforme a visão
  const series = (m: HealthMonth) =>
    view === "flow" ? [m.inn, m.out] : view === "result" ? [m.inn - m.out] : [m.cum];
  const all = months.flatMap(series);
  const rawMin = Math.min(0, ...all);
  const rawMax = Math.max(0, ...all, 1);
  const step = niceStep(rawMax - rawMin, narrow ? 3 : 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * innerH;
  const slot = innerW / months.length;
  const cx = (i: number) => PAD.left + slot * i + slot / 2;
  const zeroY = y(0);
  const barW = Math.min(view === "flow" ? 26 : 38, slot * (view === "flow" ? 0.3 : 0.5));
  const showValues = months.length <= (narrow ? 3 : 6);

  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);

  const monthLabelAt = (m: HealthMonth, i: number) => {
    const mo = MONTHS_SHORT[Number(m.ym.slice(5)) - 1];
    const showYear = i === 0 || m.ym.endsWith("-01");
    return { mo, year: showYear ? m.ym.slice(2, 4) : null };
  };
  // com muitos meses no celular, mostra um rótulo sim, um não
  const everyOther = narrow && months.length > 6;

  const result = sel.inn - sel.out;
  const hint = VIEWS.find((v) => v.id === view)!.hint;

  // caminho da linha/área (visão acumulada)
  const linePath = months.map((m, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(m.cum).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${cx(months.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${cx(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  return (
    <div>
      {/* escolha da visão */}
      <div role="tablist" aria-label="Tipo de gráfico" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-black/[0.03] p-0.5 text-[13px]">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 font-medium transition",
              view === v.id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{hint}</p>

      {/* leitura do mês escolhido, em texto */}
      <div className="mt-3 rounded-xl bg-black/[0.03] px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">{longLabel(sel.ym)}</p>
          <Link href={`${hrefBase}${sel.ym}`} className="text-xs font-medium text-primary hover:underline">
            Ver só este mês →
          </Link>
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-muted">Recebido</dt>
            <dd className="font-semibold tabular-nums">{formatBRL(sel.inn)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Gasto</dt>
            <dd className="font-semibold tabular-nums">{formatBRL(sel.out)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Resultado do mês</dt>
            <dd className={cn("font-semibold tabular-nums", result >= 0 ? "text-success" : "text-danger")}>
              {formatBRL(result)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Acumulado</dt>
            <dd className={cn("font-semibold tabular-nums", sel.cum >= 0 ? "text-success" : "text-danger")}>
              {formatBRL(sel.cum)}
            </dd>
          </div>
        </dl>
      </div>

      {/* legenda da visão */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {view === "flow" && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-success/75" /> Recebido
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-danger/65" /> Gasto
            </span>
          </>
        )}
        {view === "result" && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-success/75" /> Sobrou
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-danger/65" /> Faltou
            </span>
          </>
        )}
        {view === "cum" && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded bg-foreground" /> Resultado acumulado (R$)
          </span>
        )}
        <span className="ml-auto">Valores em R$</span>
      </div>

      <div ref={wrapRef} className="mt-1 w-full">
        <svg width={width} height={HEIGHT} role="img" aria-label={`Gráfico mês a mês: ${VIEWS.find((v) => v.id === view)!.label}`} className="block">
          <defs>
            <clipPath id={`${uid}-pos`}>
              <rect x={0} y={0} width={width} height={Math.max(0, zeroY)} />
            </clipPath>
            <clipPath id={`${uid}-neg`}>
              <rect x={0} y={zeroY} width={width} height={Math.max(0, HEIGHT - zeroY)} />
            </clipPath>
          </defs>

          {/* grade */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? "stroke-foreground/35" : "stroke-border"}
                strokeWidth={t === 0 ? 1 : 0.75}
                strokeDasharray={t === 0 ? undefined : "2 4"}
              />
              <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" className="fill-muted text-[10px]">
                {compact(t)}
              </text>
            </g>
          ))}

          {/* faixa do mês lido */}
          {(() => {
            const i = months.findIndex((m) => m.ym === sel.ym);
            return i >= 0 ? (
              <rect x={PAD.left + slot * i + 2} y={PAD.top - 6} width={slot - 4} height={innerH + 6} rx={8} className="fill-foreground/[0.045]" />
            ) : null;
          })()}

          {/* visão acumulada: área + linha */}
          {view === "cum" && (
            <g>
              <path d={areaPath} clipPath={`url(#${uid}-pos)`} className="fill-success/20" />
              <path d={areaPath} clipPath={`url(#${uid}-neg)`} className="fill-danger/20" />
              <path d={linePath} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )}

          {months.map((m, i) => {
            const faded = !m.active;
            const isSel = m.ym === sel.ym;
            const lbl = monthLabelAt(m, i);
            const bars: { v: number; cls: string; x: number }[] =
              view === "flow"
                ? [
                    { v: m.inn, cls: "fill-success/75", x: cx(i) - barW - 1.5 },
                    { v: m.out, cls: "fill-danger/65", x: cx(i) + 1.5 },
                  ]
                : view === "result"
                  ? [{ v: m.inn - m.out, cls: m.inn - m.out >= 0 ? "fill-success/75" : "fill-danger/65", x: cx(i) - barW / 2 }]
                  : [];
            return (
              <g
                key={m.ym}
                className={cn("cursor-pointer outline-none transition-opacity", faded && !isSel ? "opacity-45" : "opacity-100")}
                onMouseEnter={() => setPicked(m.ym)}
                onClick={() => setPicked(m.ym)}
                onFocus={() => setPicked(m.ym)}
                tabIndex={0}
                role="button"
                aria-label={`${longLabel(m.ym)}: recebido ${formatBRL(m.inn)}, gasto ${formatBRL(m.out)}`}
              >
                {/* área de toque do mês inteiro */}
                <rect x={PAD.left + slot * i} y={PAD.top - 6} width={slot} height={innerH + 6 + 34} fill="transparent" />

                {bars.map((b, bi) => {
                  const top = Math.min(y(b.v), zeroY);
                  const h = Math.max(b.v === 0 ? 0 : 2, Math.abs(y(b.v) - zeroY));
                  return (
                    <g key={bi}>
                      <rect x={b.x} y={top} width={barW} height={h} rx={3} className={b.cls} />
                      {showValues && b.v !== 0 && (
                        <text
                          x={b.x + barW / 2}
                          y={b.v >= 0 ? top - 4 : top + h + 11}
                          textAnchor="middle"
                          className="fill-muted text-[10px] tabular-nums"
                        >
                          {compact(b.v)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {view === "cum" && (
                  <>
                    <circle cx={cx(i)} cy={y(m.cum)} r={isSel ? 5 : 3.5} className="fill-background stroke-foreground" strokeWidth={2} />
                    {showValues && (
                      <text
                        x={cx(i)}
                        y={m.cum >= 0 ? y(m.cum) - 10 : y(m.cum) + 18}
                        textAnchor="middle"
                        className={cn("text-[10px] font-semibold tabular-nums", m.cum >= 0 ? "fill-success" : "fill-danger")}
                      >
                        {compact(m.cum)}
                      </text>
                    )}
                  </>
                )}

                {(!everyOther || i % 2 === months.length % 2) && (
                  <text
                    x={cx(i)}
                    y={HEIGHT - 16}
                    textAnchor="middle"
                    className={cn("text-[11px]", isSel ? "fill-foreground font-semibold" : "fill-muted")}
                  >
                    {lbl.mo}
                    {lbl.year && (
                      <tspan x={cx(i)} dy={12} className="fill-muted text-[9px] font-normal">
                        {lbl.year}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
