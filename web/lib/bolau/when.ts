/** "today, 2:00 PM" / "tomorrow, 9:00 AM" / "23 Ashwin 2083, 9:00 AM" (Asia/Kathmandu). Pure. */
import { addDays, adToBs, formatBs, formatTime, todayIso, type Locale } from "@/lib/format";

export type WhenKey = "today" | "tomorrow" | "other";

export function whenParts(
  iso: string,
  locale: Locale,
  now: Date = new Date(),
): { key: WhenKey; values: { time: string; date: string } } {
  const d = new Date(iso);
  const day = todayIso(d);
  const today = todayIso(now);
  const time = formatTime(iso, locale);
  const date = formatBs(adToBs(day), locale);
  const key: WhenKey = day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : "other";
  return { key, values: { time, date } };
}
