import type { CatalogFilters } from "@/lib/types";

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Converte os searchParams da URL num objeto de filtros do catálogo. */
export function parseFilters(sp: SP): CatalogFilters {
  const sizes = one(sp.sizes)?.split(",").filter(Boolean);
  const max = one(sp.max);
  const min = one(sp.min);
  const age = one(sp.age);
  const sort = one(sp.sort) as CatalogFilters["sort"] | undefined;

  return {
    q: one(sp.q) || undefined,
    gender: one(sp.gender) || undefined,
    sizes: sizes && sizes.length ? sizes : undefined,
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    ageMonths: age ? Number(age) : undefined,
    sort: sort && sort !== "relevancia" ? sort : undefined,
  };
}
