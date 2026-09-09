import { listCoupons, couponStatus } from "@/lib/data/coupons";
import { formatBRL, formatDate } from "@/lib/format";
import { CouponForm } from "@/components/admin/coupon-form";
import { toggleCouponAction, deleteCouponAction } from "@/app/admin/cupons/actions";

export const metadata = { title: "Cupons" };

export default async function AdminCouponsPage() {
  const coupons = await listCoupons();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black">Cupons de desconto</h1>
        <p className="mt-1 text-sm text-muted">
          O cliente digita o código no checkout. O desconto é sempre percentual
          sobre o subtotal (não sobre o frete).
        </p>
      </div>

      {coupons.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {coupons.map((c) => {
            const status = couponStatus(c);
            const live = status === "ativo";
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold">
                    {c.code}{" "}
                    <span className="font-semibold text-muted">· {c.percent_off}% OFF</span>
                  </p>
                  <p className="text-xs text-muted">
                    {c.min_subtotal != null ? `mín. ${formatBRL(c.min_subtotal)} · ` : ""}
                    {c.uses_count} uso{c.uses_count === 1 ? "" : "s"}
                    {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                    {c.expires_at ? ` · vence ${formatDate(c.expires_at)}` : ""}
                  </p>
                </div>

                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                    live
                      ? "bg-success/10 text-success"
                      : "bg-black/[0.06] text-muted"
                  }`}
                >
                  {status}
                </span>

                <form action={toggleCouponAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={(!c.active).toString()} />
                  <button className="text-xs font-semibold text-primary hover:underline">
                    {c.active ? "desativar" : "ativar"}
                  </button>
                </form>

                <form action={deleteCouponAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs font-semibold text-danger hover:underline">
                    excluir
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <CouponForm />
    </div>
  );
}
