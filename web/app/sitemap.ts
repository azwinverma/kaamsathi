import type { MetadataRoute } from "next";
import { BOLAU_PUBLIC_PATHS, PUBLIC_PATHS, indexableSipaluPaths, siteUrl } from "@/lib/site";
import { bolauLive, fetchBolauSearch, fetchPublicSipalu } from "@/lib/bolau/live";

export const revalidate = 3600;

const MAX_PROFILES = 100;

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
  // Search cards don't carry the opt-in, so check each profile (bounded, cached for an hour).
  const { data } = await fetchBolauSearch({ page_size: String(MAX_PROFILES) }, "en");
  const profiles = await Promise.all(
    data.results.slice(0, MAX_PROFILES).map((c) => fetchPublicSipalu(c.handle, "en")),
  );
  for (const path of indexableSipaluPaths(profiles.filter((p) => p !== null))) {
    out.push({ url: `${base}${path}`, changeFrequency: "weekly", priority: 0.4 });
  }
  return out;
}
