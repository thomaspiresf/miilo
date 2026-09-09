import { requireAdmin } from "@/lib/auth";
import { listPricingRows, getBusinessHealth } from "@/lib/data/pricing";
import { PricingClient } from "@/components/admin/pricing-client";

export default async function PricingPage() {
  await requireAdmin();
  const [{ rows, settings }, health] = await Promise.all([
    listPricingRows(),
    getBusinessHealth(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Precificação</h1>
        <p className="text-sm text-muted">
          Cadastre o custo de cada produto e veja a margem de contribuição (o que
          sobra de cada venda depois de custo, taxa do Mercado Pago e imposto).
        </p>
      </div>
      <PricingClient rows={rows} settings={settings} health={health} />
    </div>
  );
}
