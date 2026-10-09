/** Public site origin (no trailing slash). NEXT_PUBLIC_* is inlined at build time. */
export function siteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return "http://localhost:3000";
  try {
    return new URL(v).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Public, indexable pages (everything else is behind auth or private by design). */
export const PUBLIC_PATHS = ["/", "/login", "/help", "/privacy", "/terms", "/partners/docs", "/developers"] as const;

/** Never crawl: authenticated areas (incl. the Ghardhani area), booking forms, the API/BFF, and
 * private Skill Passport share links. */
export const DISALLOWED_PATHS = [
  "/app",
  "/ops",
  "/onboarding",
  "/ghar",
  "/bolau/book/",
  "/bolau/request",
  "/api",
  "/p/s/",
] as const;

/** Public Bolau pages, listed in the sitemap only while the `bolau` flag is on. */
export const BOLAU_PUBLIC_PATHS = ["/bolau", "/sipalu/join"] as const;

/** Sipalu profiles go into the sitemap only when the Sipalu opted in (`indexable`). */
export function indexableSipaluPaths(cards: { handle: string; indexable?: boolean }[]): string[] {
  return [...new Set(cards.filter((c) => c.indexable === true).map((c) => c.handle))]
    .map((handle) => `/sipalu/${handle}`);
}
