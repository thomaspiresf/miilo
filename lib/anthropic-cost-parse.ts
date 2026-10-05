/**
 * Lê a resposta do relatório de custo da Anthropic (GET /v1/organizations/cost_report).
 * Formato: { data: [{ starting_at, results: [{ amount: "centavos de dólar", currency, workspace_id }] }] }.
 * Separado do fetch pra testar sem rede.
 */

export type CostBucketResult = { amount?: string | number; currency?: string; workspace_id?: string | null };
export type CostBucket = { starting_at?: string; results?: CostBucketResult[] };

/** Soma, por mês ("YYYY-MM"), os custos em USD. `workspaceId` filtra um workspace (null = só o padrão). */
export function usdByMonth(buckets: CostBucket[], workspaceId?: string): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const b of buckets) {
    if (!b.starting_at) continue;
    const ym = b.starting_at.slice(0, 7);
    for (const r of b.results ?? []) {
      if (r.currency && r.currency !== "USD") continue;
      if (workspaceId && r.workspace_id !== workspaceId) continue;
      const cents = Number(r.amount);
      if (!Number.isFinite(cents)) continue;
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + cents / 100);
    }
  }
  return byMonth;
}
