import "server-only";
import { cache } from "react";
import { API_BASE_URL, backendJson } from "@/lib/server/session";
import type { Paginated } from "@/lib/api/types";
import type { BolauTrade, PublicSipalu, SipaluCard } from "@/lib/api/types-bolau";
import { bolauOnFromStatus } from "./flag";

/**
 * Is Bolau switched on for the public? `GET /flags` needs a session, so anonymous pages ask a
 * public, flag-gated Bolau endpoint instead: it answers 200 when the `bolau` flag is on and 404
 * when it is off. Cached for a minute (the home page header asks on every render); any network
 * problem counts as "off" so the B2B site never shows a dead link.
 */
export const bolauLive = cache(async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bolau/trades`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60, tags: ["bolau-flag"] },
      signal: AbortSignal.timeout(2500),
    });
    return bolauOnFromStatus(res.status);
  } catch {
    return false;
  }
});

export const fetchBolauTrades = cache(async (lang: string): Promise<BolauTrade[]> => {
  const res = await backendJson("/bolau/trades", { lang });
  if (res.status !== 200 || !res.data) return [];
  const d = res.data as BolauTrade[] | { results: BolauTrade[] };
  return Array.isArray(d) ? d : (d.results ?? []);
});

export async function fetchBolauSearch(
  params: Record<string, string>,
  lang: string,
): Promise<{ ok: boolean; data: Paginated<SipaluCard> }> {
  const qs = new URLSearchParams(params).toString();
  const res = await backendJson(`/bolau/search${qs ? `?${qs}` : ""}`, { lang });
  const empty = { count: 0, next: null, previous: null, results: [] };
  if (res.status !== 200 || !res.data) return { ok: false, data: empty };
  const d = res.data as Paginated<SipaluCard> | SipaluCard[];
  return { ok: true, data: Array.isArray(d) ? { ...empty, count: d.length, results: d } : d };
}

export const HANDLE_RE = /^[a-z0-9-]{3,30}$/;

/** Public Sipalu profile, memoised per request (metadata + page share one call). */
export const fetchPublicSipalu = cache(async (handle: string, lang: string): Promise<PublicSipalu | null> => {
  if (!HANDLE_RE.test(handle)) return null;
  const res = await backendJson(`/public/sipalu/${handle}`, { lang });
  if (res.status !== 200 || !res.data || typeof res.data !== "object") return null;
  return res.data as PublicSipalu;
});
