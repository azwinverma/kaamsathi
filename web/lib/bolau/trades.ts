/** Trade helpers for the Bolau hero picker and the home trades grid (pure, unit-tested). */
import type { BolauTrade, TradePriceStats } from "@/lib/api/types-bolau";

/** Household trades first, in the order people ask for them; anything else follows by Sipalu count. */
export const HOUSEHOLD_TRADE_ORDER = [
  "electrician",
  "plumber",
  "cook",
  "cleaner",
  "hvac_technician",
  "solar_technician",
  "painter",
  "carpenter",
  "housekeeping",
  "mason",
  "maintenance_technician",
  "tailor",
] as const;

type Named = { code: string; name_en: string; name_ne: string };

/** Order trades for the picker: known household trades in HOUSEHOLD_TRADE_ORDER, then the rest as given. */
export function orderTrades<T extends Named>(trades: T[], limit?: number): T[] {
  const rank = (code: string) => {
    const i = (HOUSEHOLD_TRADE_ORDER as readonly string[]).indexOf(code);
    return i === -1 ? HOUSEHOLD_TRADE_ORDER.length : i;
  };
  const sorted = trades
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t.code) - rank(b.t.code) || a.i - b.i)
    .map((x) => x.t);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** "From" price for a trade row: the lowest fixed price, else the lowest hourly rate; null when k-anonymity hides it. */
export function tradeFromPrice(t: Pick<BolauTrade, "price">): { amount: string; per: "fixed" | "hourly" } | null {
  const low = (s: TradePriceStats | null | undefined) => (s?.min && Number(s.min) > 0 ? s.min : null);
  const fixed = low(t.price?.fixed);
  if (fixed) return { amount: fixed, per: "fixed" };
  const hourly = low(t.price?.hourly);
  if (hourly) return { amount: hourly, per: "hourly" };
  return null;
}
