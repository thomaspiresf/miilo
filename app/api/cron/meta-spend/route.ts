import { NextResponse } from "next/server";
import { syncMetaSpend } from "@/lib/meta-sync";
import { logAction } from "@/lib/data/audit";

/**
 * Sincronização diária dos custos da Meta com /admin/gastos (agendada em vercel.json).
 * A Vercel chama com `Authorization: Bearer <CRON_SECRET>`; sem CRON_SECRET configurado a rota
 * recusa tudo, então ninguém de fora consegue disparar.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const lines = await syncMetaSpend();
  const changed = lines.filter((l) => l.status === "ok" && !/^Sem custo/.test(l.message));
  if (changed.length > 0) {
    await logAction({
      action: "expense.sync",
      entity: "expense",
      summary: `Sincronização diária da Meta: ${changed.map((l) => `${l.label} — ${l.message}`).join(" · ")}`,
    });
  }
  return NextResponse.json({ ok: true, lines });
}
