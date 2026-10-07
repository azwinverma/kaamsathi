import "server-only";
import { cache } from "react";
import { API_BASE_URL, backendJson } from "@/lib/server/session";
import type { PassportPayload } from "@/lib/api/types-credentials";

export const CODE_RE = /^[a-z0-9]{10}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export type PassportSource = { kind: "code"; code: string } | { kind: "share"; token: string };

function basePath(src: PassportSource): string {
  return src.kind === "code" ? `/public/passport/${src.code}` : `/public/passport/s/${src.token}`;
}

/**
 * Fetch the public passport payload (no auth). Memoised per request so generateMetadata and the
 * page share one backend call (a share-link fetch counts as a view). Returns null for any 404.
 */
export const fetchPassport = cache(
  async (
    kind: PassportSource["kind"],
    id: string,
    lang: string,
  ): Promise<PassportPayload | null> => {
    const valid = kind === "code" ? CODE_RE.test(id) : TOKEN_RE.test(id);
    if (!valid) return null;
    const src: PassportSource = kind === "code" ? { kind, code: id } : { kind, token: id };
    const res = await backendJson(basePath(src), { lang });
    if (res.status !== 200 || !res.data || typeof res.data !== "object") return null;
    return res.data as PassportPayload;
  },
);

/** QR (SVG from the backend) as a data: URI for <img>, or null when unavailable. */
export async function fetchQrDataUri(
  kind: PassportSource["kind"],
  id: string,
): Promise<string | null> {
  const src: PassportSource = kind === "code" ? { kind, code: id } : { kind, token: id };
  try {
    const res = await fetch(`${API_BASE_URL}${basePath(src)}/qr.svg`, { cache: "no-store" });
    if (!res.ok) return null;
    const svg = await res.text();
    if (!svg.includes("<svg")) return null;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}
