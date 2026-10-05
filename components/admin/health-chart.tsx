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

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const shortLabel = (ym: string) => `${SHORT[Number(ym.slice(5)) - 1]}/${ym.slice(2, 4)}`;

/** "R$ 2,3 mil" / "R$ 480" — eixo e rótulos compactos. */
function compact(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1000) return `${sign}R$ ${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}R$ ${Math.round(a)}`;
}

/** Escolhe um passo "redondo" (1, 2, 5 × 10^k) para as linhas de grade. */
function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

const W = 720;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 30, left: 62 };

/**
 * Saúde financeira mês a mês: colunas de recebido (verde) e gasto (vermelho) por
 * mês + linha do resultado acumulado. Cada mês é um link que filtra a página
 * por aquele mês. SVG puro, sem biblioteca.
 */
export function HealthChart({ months, hrefFor }: { months: HealthMonth[]; hrefFor: (ym: string) => string }) {
  if (months.length === 0) return null;

  const values = months.flatMap((m) => [m.inn, m.out, m.cum]);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values, 1);
  const step = niceStep(rawMax - rawMin, 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * innerH;
  const slot = innerW / months.length;
  const barW = Math.min(30, slot * 0.28);
  const cx = (i: number) => PAD.left + slot * i + slot / 2;

  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);

  const line = months.map((m, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(m.cum).toFixed(1)}`).join(" ");
  const last = months[months.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-success/70" /> Recebido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-danger/60" /> Gasto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded bg-foreground" /> Resultado acumulado
        </span>
        <span className="ml-auto hidden sm:inline">Clique num mês para filtrar</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gráfico mês a mês de recebido, gasto e resultado acumulado"
        className="mt-2 h-auto w-full"
      >
        {/* grade + eixo */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? "stroke-foreground/30" : "stroke-border"}
              strokeWidth={t === 0 ? 1 : 0.75}
              strokeDasharray={t === 0 ? undefined : "3 3"}
            />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" className="fill-muted text-[10px]">
              {compact(t)}
            </text>
          </g>
        ))}

        {/* colunas */}
        {months.map((m, i) => (
          <Link key={m.ym} href={hrefFor(m.ym)} aria-label={`Filtrar por ${shortLabel(m.ym)}`}>
            <g className={cn("cursor-pointer transition-opacity", m.active ? "opacity-100" : "opacity-45 hover:opacity-80")}>
              <title>
                {`${shortLabel(m.ym)} — recebido ${formatBRL(m.inn)} · gasto ${formatBRL(m.out)} · resultado do mês ${formatBRL(m.inn - m.out)} · acumulado ${formatBRL(m.cum)}`}
              </title>
              {/* área clicável do mês inteiro */}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              <rect
                x={cx(i) - barW - 1}
                y={Math.min(y(m.inn), y(0))}
                width={barW}
                height={Math.max(1, Math.abs(y(m.inn) - y(0)))}
                rx={2}
                className="fill-success/70"
              />
              <rect
                x={cx(i) + 1}
                y={Math.min(y(m.out), y(0))}
                width={barW}
                height={Math.max(1, Math.abs(y(m.out) - y(0)))}
                rx={2}
                className="fill-danger/60"
              />
              <text
                x={cx(i)}
                y={H - 10}
                textAnchor="middle"
                className={cn("text-[10px]", m.active ? "fill-foreground font-semibold" : "fill-muted")}
              >
                {shortLabel(m.ym)}
              </text>
            </g>
          </Link>
        ))}

        {/* resultado acumulado */}
        <path d={line} fill="none" className="stroke-foreground" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        {months.map((m, i) => (
          <circle key={m.ym} cx={cx(i)} cy={y(m.cum)} r={m.active ? 3.5 : 2.5} className="fill-background stroke-foreground" strokeWidth={1.5} />
        ))}
        <text
          x={Math.min(cx(months.length - 1), W - PAD.right - 4)}
          y={y(last.cum) + (last.cum >= 0 ? -9 : 16)}
          textAnchor="end"
          className={cn("text-[11px] font-semibold", last.cum >= 0 ? "fill-success" : "fill-danger")}
        >
          {compact(last.cum)}
        </text>
      </svg>
    </div>
  );
}
