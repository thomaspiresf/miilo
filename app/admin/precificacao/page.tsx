import { requireAdmin } from "@/lib/auth";
import {
  listPricingRows,
  getBusinessHealth,
  getPricingInsights,
} from "@/lib/data/pricing";

const INSIGHTS_DEFAULT_DAYS = 30;
import { PricingClient } from "@/components/admin/pricing-client";

export default async function PricingPage() {
  await requireAdmin();
  const [{ rows, settings }, health] = await Promise.all([
    listPricingRows(),
    getBusinessHealth(30),
  ]);
  const insights = await getPricingInsights(rows, {
    days: INSIGHTS_DEFAULT_DAYS,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Precificação</h1>
        <p className="text-sm text-muted">
          Cadastre o custo de cada produto e acompanhe as margens: bruta (só o
          produto), de contribuição (produto + embalagem + taxa MP + imposto) e o
          markup (preço ÷ custo).
        </p>
      </div>
      <PricingClient
        rows={rows}
        settings={settings}
        health={health}
        insights={insights}
      />
    </div>
  );
}
