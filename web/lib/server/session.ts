import "server-only";
import type { NextResponse } from "next/server";

/** Cookie names shared with middleware (keep in sync with lib/cookies.ts). */
export { ACCESS_COOKIE, REFRESH_COOKIE, ORG_COOKIE, LOCALE_COOKIE } from "@/lib/cookies";
import { ACCESS_COOKIE, REFRESH_COOKIE, ORG_COOKIE } from "@/lib/cookies";
import { clientIpRelayHeaders } from "./client-ip";

export const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:8000/api/v1").replace(
  /\/+$/,
  "",
);

const ACCESS_MAX_AGE = 30 * 60; // SimpleJWT access lifetime
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function secure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(res: NextResponse, tokens: { access: string; refresh?: string }) {
  const base = { httpOnly: true, secure: secure(), sameSite: "lax" as const, path: "/" };
  res.cookies.set(ACCESS_COOKIE, tokens.access, { ...base, maxAge: ACCESS_MAX_AGE });
  if (tokens.refresh) {
    res.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...base, maxAge: REFRESH_MAX_AGE });
  }
}

export function clearAuthCookies(res: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ORG_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export function setOrgCookie(res: NextResponse, orgId: string) {
  res.cookies.set(ORG_COOKIE, orgId, {
    httpOnly: false, // readable by the org switcher; not a secret (server re-checks membership)
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

/** Call the backend with JSON; never throws on HTTP errors. */
export async function backendJson(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    access?: string;
    lang?: string;
    /** Incoming browser request headers: relays the user's IP (OTP throttles, audit log). */
    from?: Headers;
  } = {},
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.from ? clientIpRelayHeaders(init.from) : {}),
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.access) headers.Authorization = `Bearer ${init.access}`;
  if (init.lang) headers["Accept-Language"] = init.lang;
  // Correlates BFF auth calls with backend logs / error envelopes (docs/CONTRACT-EXTENSIONS.md §1).
  headers["X-Request-ID"] = globalThis.crypto.randomUUID().replace(/-/g, "");
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  } catch {
    return {
      status: 502,
      data: {
        error: {
          code: "server_error",
          message: "The KaamSathi server is unreachable. Please try again shortly.",
        },
      },
    };
  }
}

/**
 * Refresh tokens. Deduplicated per refresh token so that parallel 401s don't race
 * (SimpleJWT rotates + blacklists, so a second refresh with the same token would fail).
 */
const inflight = new Map<string, { at: number; promise: Promise<{ access: string; refresh?: string } | null> }>();

export function refreshTokens(refresh: string): Promise<{ access: string; refresh?: string } | null> {
  const now = Date.now();
  for (const [k, v] of inflight) if (now - v.at > 30_000) inflight.delete(k);
  const existing = inflight.get(refresh);
  if (existing) return existing.promise;
  const promise = backendJson("/auth/token/refresh", { method: "POST", body: { refresh } }).then(
    ({ status, data }) => {
      if (status !== 200 || !data || typeof data !== "object") return null;
      const d = data as { access?: string; refresh?: string };
      return d.access ? { access: d.access, refresh: d.refresh } : null;
    },
  );
  inflight.set(refresh, { at: now, promise });
  return promise;
}
