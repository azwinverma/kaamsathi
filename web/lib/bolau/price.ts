/**
 * Bolau price + booking-fee wording (pure, unit-tested). Components turn the returned message key
 * into copy with `t("bolau.price.<key>", values)`.
 *
 * Rules (docs/CONTRACT-BOLAU.md §6): the Ghardhani pays the Sipalu directly; KaamSathi's own booking
 * fee is charged to the Ghardhani only, and is "waived" while the payment gateway is off.
 */
import { formatMoney, type Locale } from "@/lib/format";
import type { BookingFeeStatus, PriceType } from "@/lib/api/types-bolau";

export interface Priced {
  price_type: PriceType;
  price?: string | number | null;
  visit_fee?: string | number | null;
}

export type PriceKey = "fixed" | "hourly" | "visit_then_quote" | "visit_free" | "ask";

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "Rs. 600 fixed" / "Rs. 300 an hour" / "Visit Rs. 200, then a quote". */
export function priceLabel(p: Priced, locale: Locale): { key: PriceKey; values: { price: string; visit_fee: string } } {
  const price = num(p.price);
  const visit = num(p.visit_fee);
  const values = {
    price: price === null ? "" : formatMoney(price, locale),
    visit_fee: visit === null ? "" : formatMoney(visit, locale),
  };
  if (p.price_type === "visit_then_quote") return { key: visit ? "visit_then_quote" : "visit_free", values };
  if (price === null) return { key: "ask", values };
  return { key: p.price_type === "hourly" ? "hourly" : "fixed", values };
}

/**
 * What the Ghardhani should expect to pay the Sipalu (not KaamSathi). Hourly → rate × estimated
 * hours (rounded up to the half hour, at least one hour). Visit-then-quote → just the visit fee.
 */
export function estimateToSipalu(p: Priced, estimatedMinutes?: number | null): number | null {
  const price = num(p.price);
  if (p.price_type === "visit_then_quote") return num(p.visit_fee) ?? 0;
  if (price === null) return null;
  if (p.price_type === "fixed") return price;
  const minutes = Math.max(60, estimatedMinutes ?? 60);
  const hours = Math.ceil(minutes / 30) / 2;
  return Math.round(price * hours);
}

/** Booking-fee line: amount > 0 and not waived → "fee", otherwise "waived". */
export function feeLine(
  fee: string | number | null | undefined,
  status: BookingFeeStatus | "enabled" | "disabled" | null | undefined,
  locale: Locale,
): { key: "fee" | "waived" | "refunded"; amount: string } {
  const n = num(fee) ?? 0;
  const amount = formatMoney(n, locale);
  if (status === "refunded") return { key: "refunded", amount };
  if (status === "waived" || status === "disabled" || n <= 0) return { key: "waived", amount };
  return { key: "fee", amount };
}

/** Free cancellation until `hours` before the start (default 2 h). */
export function freeCancelUntil(scheduledStart: string, hours = 2): Date {
  return new Date(new Date(scheduledStart).getTime() - hours * 3600_000);
}

export function insideFreeWindow(scheduledStart: string, now: Date = new Date(), hours = 2): boolean {
  return now.getTime() <= freeCancelUntil(scheduledStart, hours).getTime();
}

/** Rating 0–5 as "4.8" (one decimal), or null when there are no ratings yet. */
export function ratingText(avg: string | number | null | undefined, count: number): string | null {
  const n = num(avg);
  if (n === null || !count) return null;
  return (Math.round(n * 10) / 10).toFixed(1);
}
