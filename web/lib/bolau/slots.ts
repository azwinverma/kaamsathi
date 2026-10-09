/**
 * Build bookable time slots from a Sipalu's weekly availability (pure, unit-tested).
 * All times are Asia/Kathmandu (UTC+05:45, no DST). The API re-validates everything
 * (lead time, time off, overlap, service area); this only offers sensible choices.
 */
import { addDays, todayIso } from "@/lib/format";
import type { AvailabilityRule, AvailabilitySummary, TimeOff } from "@/lib/api/types-bolau";

export const NPT_OFFSET = "+05:45";

/**
 * Which weekday numbering AvailabilityRule.weekday uses. The Bolau API uses Sunday = 0 (same as
 * the BS calendar API: backend apps/bolau/models.py AvailabilityRule). Python `date.weekday()` would be
 * Monday = 0 … Sunday = 6 ("mon0"); JavaScript `getUTCDay()` is Sunday = 0 ("sun0").
 */
export const AVAILABILITY_WEEKDAY_BASE: "mon0" | "sun0" = "sun0";

/** JS weekday (Sun = 0) → rule weekday. */
export function ruleWeekday(jsDay: number, base: "mon0" | "sun0" = AVAILABILITY_WEEKDAY_BASE): number {
  return base === "mon0" ? (jsDay + 6) % 7 : jsDay;
}

/** Rule weekday → JS weekday (Sun = 0), for labels. */
export function jsWeekday(rule: number, base: "mon0" | "sun0" = AVAILABILITY_WEEKDAY_BASE): number {
  return base === "mon0" ? (rule + 1) % 7 : rule;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function jsDayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface Slot {
  /** ISO datetime with the +05:45 offset, ready for `scheduled_start`. */
  start: string;
  /** "09:00" local clock. */
  time: string;
}

export interface SlotDay {
  date: string;
  jsWeekday: number;
  slots: Slot[];
}

export interface BuildSlotsInput {
  rules: AvailabilityRule[];
  timeOff?: TimeOff[];
  busy?: { start: string; end: string }[];
  now?: Date;
  days?: number;
  stepMinutes?: number;
  durationMinutes?: number;
  leadMinutes?: number;
  weekdayBase?: "mon0" | "sun0";
}

/** Next `days` days (today first) with the start times that fit inside the weekly rules. */
export function buildSlots({
  rules,
  timeOff = [],
  busy = [],
  now = new Date(),
  days = 14,
  stepMinutes = 60,
  durationMinutes = 60,
  leadMinutes = 60,
  weekdayBase = AVAILABILITY_WEEKDAY_BASE,
}: BuildSlotsInput): SlotDay[] {
  const earliest = now.getTime() + leadMinutes * 60_000;
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const today = todayIso(now);
  const out: SlotDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const js = jsDayOf(date);
    const off = timeOff.some((o) => o.from_date <= date && date <= o.to_date);
    const slots: Slot[] = [];
    if (!off) {
      const dayRules = rules
        .filter((r) => r.weekday === ruleWeekday(js, weekdayBase))
        .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
      const seen = new Set<string>();
      for (const r of dayRules) {
        const from = minutesOf(r.start_time);
        const to = minutesOf(r.end_time);
        for (let m = from; m + durationMinutes <= to; m += stepMinutes) {
          const time = hhmm(m);
          if (seen.has(time)) continue;
          const start = `${date}T${time}:00${NPT_OFFSET}`;
          const ms = Date.parse(start);
          if (ms < earliest) continue;
          const end = ms + durationMinutes * 60_000;
          if (busyMs.some(([bs, be]) => ms < be && end > bs)) continue;
          seen.add(time);
          slots.push({ start, time });
        }
      }
    }
    out.push({ date, jsWeekday: js, slots });
  }
  return out;
}

/** Compact weekly summary: rule weekdays grouped by identical hours, e.g. Sun–Fri 08:00–18:00. */
export function weeklySummary(
  rules: AvailabilityRule[],
  weekdayBase: "mon0" | "sun0" = AVAILABILITY_WEEKDAY_BASE,
): { days: number[]; start: string; end: string }[] {
  const byHours = new Map<string, number[]>();
  for (const r of rules) {
    const key = `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`;
    const list = byHours.get(key) ?? [];
    list.push(jsWeekday(r.weekday, weekdayBase));
    byHours.set(key, list);
  }
  return [...byHours.entries()]
    .map(([k, days]) => {
      const [start, end] = k.split("-");
      return { days: [...new Set(days)].sort((a, b) => a - b), start, end };
    })
    .sort((a, b) => a.days[0] - b.days[0]);
}

/** Flatten the API's availability summary (`weekly: [{weekday, ranges}]`) or plain rules. */
export function summaryRules(summary: AvailabilitySummary | null | undefined): AvailabilityRule[] {
  if (!summary) return [];
  if (summary.rules?.length) return summary.rules;
  return (summary.weekly ?? []).flatMap((d) =>
    d.ranges.map(([start_time, end_time]) => ({ weekday: d.weekday, start_time, end_time })),
  );
}
