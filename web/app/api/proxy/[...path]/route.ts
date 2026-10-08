import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  API_BASE_URL,
  LOCALE_COOKIE,
  ORG_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  refreshTokens,
  setAuthCookies,
} from "@/lib/server/session";
import { rejectCrossSite, resolveRequestId } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

/** Token-issuing endpoints must never be reachable through the proxy (tokens would leak to JS). */
const BLOCKED = [
  /^auth\/otp\/verify\/?$/,
  /^auth\/mfa\/verify\/?$/,
  /^auth\/token\//,
  /^auth\/logout\/?$/,
];

/** Response headers passed back to the browser. */
const PASS_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  "cache-control",
  "etag",
  "last-modified",
  "x-request-id",
  "idempotent-replayed",
];

/** Idempotency-Key is forwarded only when it looks sane (backend caps it at 100 chars). */
const IDEMPOTENCY_KEY_RE = /^[\x21-\x7e]{1,100}$/;

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = resolveRequestId(req.headers.get("x-request-id"));
  const blocked = rejectCrossSite(req);
  if (blocked) {
    blocked.headers.set("x-request-id", requestId);
    return blocked;
  }
  const errorJson = (status: number, code: string, message: string) =>
    NextResponse.json(
      { error: { code, message, request_id: requestId } },
      { status, headers: { "x-request-id": requestId } },
    );
  const { path } = await ctx.params;
  const segments = (path ?? []).map((s) => decodeURIComponent(s));
  if (segments.some((s) => s === ".." || s === "." || s.includes("/") || s.includes("\\"))) {
    return errorJson(400, "validation_error", "Invalid path.");
  }
  const joined = segments.join("/");
  if (BLOCKED.some((re) => re.test(joined))) return errorJson(404, "not_found", "Not found.");

  // Preserve DRF trailing-slash semantics: forward exactly what the client asked for.
  const trailing = req.nextUrl.pathname.endsWith("/") ? "/" : "";
  const target = `${API_BASE_URL}/${segments.map(encodeURIComponent).join("/")}${trailing}${req.nextUrl.search}`;

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  // Buffer the body once so it can be replayed after a token refresh.
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: { access: string; refresh?: string } | null = null;
  let refreshFailed = false;

  // Access cookie expired (maxAge) but refresh still valid → refresh up front.
  if (!access && refresh) {
    refreshed = await refreshTokens(refresh);
    if (refreshed) access = refreshed.access;
    else refreshFailed = true;
  }

  const send = (token: string | undefined) => {
    const headers = new Headers();
    headers.set("Accept", req.headers.get("accept") ?? "application/json");
    const ct = req.headers.get("content-type");
    if (ct && hasBody) headers.set("Content-Type", ct);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const org = req.cookies.get(ORG_COOKIE)?.value;
    if (org) headers.set("X-Org-Id", org);
    const locale = req.cookies.get(LOCALE_COOKIE)?.value;
    headers.set("Accept-Language", locale === "ne" ? "ne" : "en");
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) headers.set("X-Forwarded-For", fwd);
    headers.set("X-Request-ID", requestId);
    const idem = req.headers.get("idempotency-key");
    if (idem && hasBody && IDEMPOTENCY_KEY_RE.test(idem)) headers.set("Idempotency-Key", idem);
    return fetch(target, { method, headers, body, cache: "no-store", redirect: "manual" }).then(
      async (r) => {
        // Django APPEND_SLASH redirect (GET only): follow once to the same host.
        const loc = r.headers.get("location");
        if ([301, 302, 307, 308].includes(r.status) && loc && method === "GET") {
          const next = new URL(loc, target);
          if (next.origin === new URL(API_BASE_URL).origin) {
            return fetch(next, { method, headers, cache: "no-store", redirect: "manual" });
          }
        }
        return r;
      },
    );
  };

  let upstream: Response;
  try {
    upstream = await send(access);
    if (upstream.status === 401 && refresh && !refreshed && !refreshFailed) {
      refreshed = await refreshTokens(refresh);
      if (refreshed) {
        access = refreshed.access;
        upstream = await send(access);
      } else {
        refreshFailed = true;
      }
    }
  } catch {
    return errorJson(502, "server_error", "The KaamSathi server is unreachable. Please try again shortly.");
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);

  // Stream the body through untouched (JSON, xlsx, csv, pdf, png…).
  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
  if (refreshed) setAuthCookies(res, refreshed);
  if (refreshFailed || (upstream.status === 401 && !refresh)) clearAuthCookies(res);
  return res;
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
