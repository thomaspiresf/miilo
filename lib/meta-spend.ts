import "server-only";

/**
 * Custos da Meta lidos direto da API: mensagens do WhatsApp Business (pricing_analytics da conta
 * do WhatsApp) e anúncios do Facebook/Instagram (insights da conta de anúncios). Cada fonte só
 * roda se estiver configurada; sem configuração devolve "skipped" e a tela explica o que falta.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type MonthAmount = { ym: string; amount: number };
export type SpendFetch =
  | { status: "ok"; months: MonthAmount[] }
  | { status: "skipped"; message: string }
  | { status: "error"; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

function metaError(json: unknown, fallback: string): string {
  const err = (json as { error?: { message?: string; code?: number } } | null)?.error;
  return err?.message ? `${err.message}${err.code ? ` (código ${err.code})` : ""}` : fallback;
}

/** "YYYY-MM-01" em UTC `n` meses antes do mês de `ref`. */
function monthStartUtc(ref: Date, monthsBack: number): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - monthsBack, 1));
}

const ymOfUnix = (sec: number) => {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Custo das mensagens do WhatsApp Business por mês (moeda da conta do WhatsApp). */
export async function fetchWhatsAppSpend(monthsBack = 2): Promise<SpendFetch> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const waba = process.env.META_WABA_ID;
  if (!token) return { status: "skipped", message: "Falta WHATSAPP_ACCESS_TOKEN." };
  if (!waba) return { status: "skipped", message: "Falta META_WABA_ID (identificação da conta do WhatsApp Business)." };

  const now = new Date();
  const start = Math.floor(monthStartUtc(now, monthsBack).getTime() / 1000);
  const end = Math.floor(now.getTime() / 1000);
  const fields = `pricing_analytics.start(${start}).end(${end}).granularity(DAILY).metric_types(["COST"])`;
  try {
    const res = await fetch(`${GRAPH}/${waba}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { status: "error", message: metaError(json, `A Meta respondeu ${res.status}.`) };

    const byMonth = new Map<string, number>();
    type Point = { start?: number; cost?: number };
    const blocks = (json as { pricing_analytics?: { data?: { data_points?: Point[] }[] } })?.pricing_analytics?.data ?? [];
    for (const block of blocks) {
      for (const p of block.data_points ?? []) {
        if (typeof p.start !== "number" || typeof p.cost !== "number") continue;
        const ym = ymOfUnix(p.start);
        byMonth.set(ym, (byMonth.get(ym) ?? 0) + p.cost);
      }
    }
    return { status: "ok", months: [...byMonth].map(([ym, amount]) => ({ ym, amount: round2(amount) })).sort((a, b) => a.ym.localeCompare(b.ym)) };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Falha ao falar com a Meta." };
  }
}

/** Gasto com anúncios por mês, da conta de anúncios (Facebook/Instagram). */
export async function fetchAdsSpend(monthsBack = 2): Promise<SpendFetch> {
  const token = process.env.META_ADS_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const account = (process.env.META_ADS_ACCOUNT_ID || "").replace(/^act_/, "");
  if (!account) return { status: "skipped", message: "Anúncios ainda não ligados (falta META_ADS_ACCOUNT_ID)." };
  if (!token) return { status: "skipped", message: "Falta um token da Meta (META_ADS_ACCESS_TOKEN)." };

  const now = new Date();
  const since = monthStartUtc(now, monthsBack).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    fields: "spend",
    time_increment: "monthly",
    time_range: JSON.stringify({ since, until }),
    limit: "50",
  });
  try {
    const res = await fetch(`${GRAPH}/act_${account}/insights?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { status: "error", message: metaError(json, `A Meta respondeu ${res.status}.`) };

    const rows = (json as { data?: { spend?: string; date_start?: string }[] })?.data ?? [];
    const months = rows
      .filter((r) => r.date_start && r.spend != null)
      .map((r) => ({ ym: String(r.date_start).slice(0, 7), amount: round2(Number(r.spend)) }))
      .sort((a, b) => a.ym.localeCompare(b.ym));
    return { status: "ok", months };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Falha ao falar com a Meta." };
  }
}

// --------------------------------------------------------------------------
//  Anthropic (IA do site: leitura de notas e bot) — API de administração
// --------------------------------------------------------------------------
import { usdByMonth, type CostBucket } from "@/lib/anthropic-cost-parse";

/** Cotação do dólar em reais: serviço público sem chave; cai pra USD_BRL_RATE se estiver fora do ar. */
async function usdToBrl(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { cache: "no-store" });
    const bid = Number((await res.json())?.USDBRL?.bid);
    if (res.ok && bid > 0) return bid;
  } catch {
    /* tenta o valor fixo */
  }
  const fixed = Number(process.env.USD_BRL_RATE);
  return fixed > 0 ? fixed : null;
}

/** Custo da API da Anthropic por mês, convertido pra reais. Precisa de uma Admin API key. */
export async function fetchAnthropicSpend(monthsBack = 2): Promise<SpendFetch> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return { status: "skipped", message: "Ainda não ligado (falta ANTHROPIC_ADMIN_KEY)." };

  const now = new Date();
  const startingAt = monthStartUtc(now, monthsBack).toISOString().replace(".000", "");
  const endingAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + "T00:00:00Z";

  const buckets: CostBucket[] = [];
  let page: string | null = null;
  try {
    for (let i = 0; i < 6; i++) {
      const qs = new URLSearchParams({ starting_at: startingAt, ending_at: endingAt, limit: "31" });
      qs.append("group_by[]", "workspace_id");
      if (page) qs.set("page", page);
      const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${qs}`, {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "user-agent": "miilo/1.0 (https://miilo.com.br)" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (json as { error?: { message?: string } } | null)?.error?.message;
        return { status: "error", message: msg ? `Anthropic: ${msg}` : `A Anthropic respondeu ${res.status}.` };
      }
      buckets.push(...(((json as { data?: CostBucket[] })?.data) ?? []));
      const next = json as { has_more?: boolean; next_page?: string };
      if (!next.has_more || !next.next_page) break;
      page = next.next_page;
    }
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Falha ao falar com a Anthropic." };
  }

  const usd = usdByMonth(buckets, process.env.ANTHROPIC_WORKSPACE_ID || undefined);
  if (usd.size === 0) return { status: "ok", months: [] };
  const rate = await usdToBrl();
  if (!rate) return { status: "error", message: "Não consegui a cotação do dólar (defina USD_BRL_RATE)." };
  return {
    status: "ok",
    months: [...usd].map(([ym, v]) => ({ ym, amount: round2(v * rate) })).sort((a, b) => a.ym.localeCompare(b.ym)),
  };
}
