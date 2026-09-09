import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getAllProductSlugs, getCategories } from "@/lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.site.url;
  let productSlugs: string[] = [];
  let categorySlugs: string[] = [];

  try {
    [productSlugs, categorySlugs] = await Promise.all([
      getAllProductSlugs(),
      getCategories().then((cs) => cs.map((c) => c.slug)),
    ]);
  } catch {
    /* sem banco no build — sitemap mínimo */
  }

  return [
    { url: base, priority: 1 },
    { url: `${base}/c/roupas` },
    { url: `${base}/c/brinquedos` },
    { url: `${base}/c/livros` },
    ...categorySlugs.map((s) => ({ url: `${base}/c/${s}` })),
    ...productSlugs.map((s) => ({ url: `${base}/p/${s}` })),
  ];
}
