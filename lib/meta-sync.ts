import "server-only";
import { fetchAdsSpend, fetchWhatsAppSpend, type SpendFetch } from "@/lib/meta-spend";
import { upsertSyncedExpense, type SyncedExpense } from "@/lib/data/expenses";
import { addDays, currentMonthBr, shiftMonth, todayBr } from "@/lib/expenses";

export type SyncLine = { source: "whatsapp" | "ads"; label: string; status: "ok" | "skipped" | "error"; message: string };

const SOURCES = [
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    key: "meta_whatsapp",
    fetch: fetchWhatsAppSpend,
    category: "outros" as const,
    description: "Meta — mensagens do WhatsApp Business",
  },
  {
    id: "ads" as const,
    label: "Anúncios",
    key: "meta_ads",
    fetch: fetchAdsSpend,
    category: "marketing" as const,
    description: "Meta Ads — anúncios Facebook/Instagram",
  },
];

/** Data do lançamento do mês: hoje no mês corrente, último dia nos meses fechados. */
function spentOnFor(ym: string): string {
  const today = todayBr();
  return ym >= currentMonthBr() ? today : addDays(`${shiftMonth(ym, 1)}-01`, -1);
}

/**
 * Lê os custos da Meta dos últimos 3 meses e mantém UMA linha por mês e por fonte em Gastos
 * (o valor do mês corrente vai subindo a cada sincronização).
 */
export async function syncMetaSpend(): Promise<SyncLine[]> {
  const lines: SyncLine[] = [];
  for (const src of SOURCES) {
    const result: SpendFetch = await src.fetch(2);
    if (result.status !== "ok") {
      lines.push({ source: src.id, label: src.label, status: result.status, message: result.message });
      continue;
    }
    let created = 0;
    let updated = 0;
    try {
      for (const m of result.months) {
        const e: SyncedExpense = {
          source: src.key,
          sourceKey: `${src.key}:${m.ym}`,
          spentOn: spentOnFor(m.ym),
          category: src.category,
          description: src.description,
          supplier: "Meta",
          amount: m.amount,
        };
        const r = await upsertSyncedExpense(e);
        if (r === "created") created++;
        if (r === "updated") updated++;
      }
    } catch (err) {
      lines.push({ source: src.id, label: src.label, status: "error", message: err instanceof Error ? err.message : "Falha ao salvar." });
      continue;
    }
    const total = result.months.reduce((s, m) => s + m.amount, 0);
    lines.push({
      source: src.id,
      label: src.label,
      status: "ok",
      message:
        total === 0
          ? "Sem custo nos últimos 3 meses."
          : `${created} novo${created === 1 ? "" : "s"}, ${updated} atualizado${updated === 1 ? "" : "s"} (últimos 3 meses).`,
    });
  }
  return lines;
}
