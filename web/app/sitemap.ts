import type { MetadataRoute } from "next";
import { BOLAU_PUBLIC_PATHS, PUBLIC_PATHS, indexableSipaluPaths, siteUrl } from "@/lib/site";
import { bolauLive, fetchBolauSearch } from "@/lib/bolau/live";

export const revalidate = 3600;

const PAGE_SIZE = 100; // API max page size
const MAX_PAGES = 10;

/**
 * Static public pages, plus — only while the `bolau` flag is on — /bolau, /sipalu/join and the
 * Sipalu profiles whose owners opted in to search indexing (`indexable`, default off).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const out: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/login" ? 0.6 : 0.5,
  }));
  if (!(await bolauLive())) return out;

  for (const path of BOLAU_PUBLIC_PATHS) {
    out.push({ url: `${base}${path}`, changeFrequency: "daily", priority: path === "/bolau" ? 0.8 : 0.5 });
  }
  // Search cards carry the Sipalu's opt-in (`indexable`), so no per-profile fetch is needed.
  const cards = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { ok, data } = await fetchBolauSearch({ page_size: String(PAGE_SIZE), page: String(page) }, "en");
    if (!ok) break;
    cards.push(...data.results);
    if (!data.next) break;
  }
  for (const path of indexableSipaluPaths(cards)) {
    out.push({ url: `${base}${path}`, changeFrequency: "weekly", priority: 0.4 });
  }
  return out;
}
