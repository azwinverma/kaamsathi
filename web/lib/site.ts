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
export const PUBLIC_PATHS = ["/", "/login", "/privacy", "/terms", "/partners/docs"] as const;

/** Never crawl: authenticated areas, the API/BFF, and private Skill Passport share links. */
export const DISALLOWED_PATHS = ["/app", "/ops", "/onboarding", "/api", "/p/s/"] as const;
