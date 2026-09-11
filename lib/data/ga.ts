import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { env, hasGaData } from "@/lib/env";

export type GaRange = { days?: 7 | 15 | 30 | 90; from?: string; to?: string };

export type GaFunnelStep = { key: string; label: string; count: number };
export type GaChannel = { channel: string; sessions: number; users: number };

export type GaOverview = {
  hasCompare: boolean;
  users: number;
  prevUsers: number;
  sessions: number;
  prevSessions: number;
  pageViews: number;
  prevPageViews: number;
  /** 0–1 */
  engagementRate: number;
  prevEngagementRate: number;
  revenue: number;
  prevRevenue: number;
  transactions: number;
  prevTransactions: number;
  funnel: GaFunnelStep[];
  acquisition: GaChannel[];
  realtimeUsers: number | null;
};

let cachedClient: BetaAnalyticsDataClient | null = null;

function client() {
  if (!cachedClient) {
    cachedClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: env.ga.serviceAccountEmail,
        private_key: env.ga.serviceAccountKey,
      },
    });
  }
  return cachedClient;
}

function property() {
  return `properties/${env.ga.propertyId}`;
}

// --------------------------------------------------------------------------
//  Datas — GA4 aceita "NdaysAgo" / "today" direto, ou YYYY-MM-DD.
// --------------------------------------------------------------------------
function isoDaysAgo(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function resolveRange(range: GaRange): {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  hasCompare: boolean;
} {
  if (range.from && range.to) {
    const spanDays =
      Math.round(
        (new Date(`${range.to}T00:00:00Z`).getTime() -
          new Date(`${range.from}T00:00:00Z`).getTime()) /
          86400000,
      ) + 1;
    return {
      start: range.from,
      end: range.to,
      prevEnd: isoDaysAgo(range.from, 1),
      prevStart: isoDaysAgo(range.from, spanDays),
      hasCompare: true,
    };
  }
  if (range.days) {
    return {
      start: `${range.days}daysAgo`,
      end: "today",
      prevStart: `${range.days * 2}daysAgo`,
      prevEnd: `${range.days + 1}daysAgo`,
      hasCompare: true,
    };
  }
  // "Tudo" — GA4 recorta sozinho pro início real da coleta de dados.
  return {
    start: "2020-01-01",
    end: "today",
    prevStart: "2020-01-01",
    prevEnd: "2020-01-01",
    hasCompare: false,
  };
}

const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: "view_item", label: "Viu o produto" },
  { key: "add_to_cart", label: "Adicionou à sacola" },
  { key: "begin_checkout", label: "Iniciou o checkout" },
  { key: "purchase", label: "Comprou" },
];

const CHANNEL_LABELS: Record<string, string> = {
  Direct: "Direto",
  "Organic Search": "Busca orgânica",
  "Paid Search": "Busca paga",
  "Organic Social": "Redes sociais",
  "Paid Social": "Anúncio (redes sociais)",
  Referral: "Indicação",
  Email: "E-mail",
  Display: "Display",
  Affiliates: "Afiliados",
  "Organic Video": "Vídeo orgânico",
  "Paid Video": "Anúncio (vídeo)",
  "Paid Shopping": "Anúncio (shopping)",
  "Organic Shopping": "Shopping orgânico",
  "Unassigned": "Não identificado",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(row: any, i: number): number {
  return Number(row?.metricValues?.[i]?.value ?? 0);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getGaOverview(
  range: GaRange,
): Promise<GaOverview | { error: string }> {
  if (!hasGaData()) return { error: "Google Analytics não configurado." };

  const { start, end, prevStart, prevEnd, hasCompare } = resolveRange(range);
  const c = client();

  try {
    const [overviewRes, funnelRes, acquisitionRes, realtimeRes] = await Promise.all([
      c.runReport({
        property: property(),
        dimensions: [{ name: "dateRange" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "purchaseRevenue" },
          { name: "transactions" },
        ],
        dateRanges: hasCompare
          ? [
              { startDate: start, endDate: end, name: "current" },
              { startDate: prevStart, endDate: prevEnd, name: "previous" },
            ]
          : [{ startDate: start, endDate: end, name: "current" }],
      }),
      c.runReport({
        property: property(),
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dateRanges: [{ startDate: start, endDate: end }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: FUNNEL_STEPS.map((s) => s.key) },
          },
        },
      }),
      c.runReport({
        property: property(),
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        dateRanges: [{ startDate: start, endDate: end }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      c.runRealtimeReport({
        property: property(),
        metrics: [{ name: "activeUsers" }],
      }),
    ]);

    const [overview] = overviewRes;
    const [funnelReport] = funnelRes;
    const [acquisitionReport] = acquisitionRes;
    const [realtime] = realtimeRes;

    const rowFor = (name: string) =>
      overview.rows?.find((r) => r.dimensionValues?.[0]?.value === name);
    const cur = rowFor("current") ?? overview.rows?.[0];
    const prev = hasCompare ? rowFor("previous") : undefined;

    const counts = new Map(FUNNEL_STEPS.map((s) => [s.key, 0]));
    for (const row of funnelReport.rows ?? []) {
      const name = row.dimensionValues?.[0]?.value;
      if (name && counts.has(name)) counts.set(name, num(row, 0));
    }

    const acquisition: GaChannel[] = (acquisitionReport.rows ?? []).map((row) => {
      const raw = row.dimensionValues?.[0]?.value ?? "Não identificado";
      return {
        channel: CHANNEL_LABELS[raw] ?? raw,
        sessions: num(row, 0),
        users: num(row, 1),
      };
    });

    const realtimeUsers = realtime.rows?.length
      ? Number(realtime.rows[0]?.metricValues?.[0]?.value ?? 0)
      : 0;

    return {
      hasCompare,
      users: num(cur, 0),
      prevUsers: num(prev, 0),
      sessions: num(cur, 1),
      prevSessions: num(prev, 1),
      pageViews: num(cur, 2),
      prevPageViews: num(prev, 2),
      engagementRate: num(cur, 3),
      prevEngagementRate: num(prev, 3),
      revenue: num(cur, 4),
      prevRevenue: num(prev, 4),
      transactions: num(cur, 5),
      prevTransactions: num(prev, 5),
      funnel: FUNNEL_STEPS.map((s) => ({ ...s, count: counts.get(s.key) ?? 0 })),
      acquisition,
      realtimeUsers,
    };
  } catch (err) {
    console.error("[ga] runReport falhou:", (err as Error).message);
    return {
      error:
        "Não consegui ler o Google Analytics. Confira se a conta de serviço tem acesso de leitor na propriedade.",
    };
  }
}
