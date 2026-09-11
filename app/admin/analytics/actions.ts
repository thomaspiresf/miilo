"use server";

import { requireAdmin } from "@/lib/auth";
import { getGaOverview, type GaOverview, type GaRange } from "@/lib/data/ga";

export async function loadGaOverviewAction(
  range: GaRange,
): Promise<GaOverview | { error: string }> {
  await requireAdmin();
  return getGaOverview(range);
}
