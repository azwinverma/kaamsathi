/**
 * BFF CSRF defence. Auth cookies are SameSite=Lax, but every mutating BFF handler additionally
 * rejects cross-site browser requests using Fetch Metadata (`Sec-Fetch-Site`) and `Origin`.
 * Requests carrying neither header (curl, server-to-server) are allowed.
 */
import { NextResponse } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface OriginCheckInput {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
  forwardedHost?: string | null;
  /** Extra trusted origins (`https://a.example`) or hosts (`a.example:8443`). */
  allowed?: readonly string[];
}

/** Parse the comma-separated `ALLOWED_ORIGINS` env value. */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ""))
    .filter(Boolean);
}

function firstHeaderValue(v: string | null | undefined): string | null {
  if (!v) return null;
  const first = v.split(",")[0]?.trim().toLowerCase();
  return first || null;
}

function isAllowListed(origin: URL, allowed: readonly string[]): boolean {
  const o = origin.origin.toLowerCase();
  const h = origin.host.toLowerCase();
  return allowed.some((a) => (a.includes("://") ? a === o : a === h));
}

/** True when the request must be blocked as cross-site. Pure; unit tested. */
export function isCrossSiteRequest(input: OriginCheckInput): boolean {
  if (!MUTATING.has(input.method.toUpperCase())) return false;
  const allowed = input.allowed ?? [];
  const site = input.secFetchSite?.trim().toLowerCase() || null;

  let origin: URL | null = null;
  if (input.origin !== null && input.origin !== undefined) {
    // "null" (opaque origin: sandboxed iframe, data: URL, some redirects) is never trusted.
    try {
      origin = new URL(input.origin);
    } catch {
      return true;
    }
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return true;
  }
  const listed = origin ? isAllowListed(origin, allowed) : false;

  if (site && site !== "same-origin" && !listed) return true;

  if (origin) {
    const host = firstHeaderValue(input.forwardedHost) ?? firstHeaderValue(input.host);
    if (listed) return false;
    if (!host || origin.host.toLowerCase() !== host) return true;
  }
  return false;
}

type RequestLike = { method: string; headers: Headers };

/** Returns a 403 response for cross-site mutating requests, otherwise null. */
export function rejectCrossSite(req: RequestLike): NextResponse | null {
  const blocked = isCrossSiteRequest({
    method: req.method,
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    host: req.headers.get("host"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    allowed: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  });
  if (!blocked) return null;
  return NextResponse.json(
    { error: { code: "permission_denied", message: "Cross-site request blocked." } },
    { status: 403 },
  );
}

// ---------------------------------------------------------------- request ids
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** Keep a caller-supplied X-Request-ID when it is safe, otherwise mint a new one. */
export function resolveRequestId(incoming: string | null | undefined): string {
  const v = incoming?.trim();
  if (v && REQUEST_ID_RE.test(v)) return v;
  return crypto.randomUUID();
}
