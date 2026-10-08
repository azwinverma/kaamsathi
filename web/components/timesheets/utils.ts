import { addDays, weekdayOf } from "@/lib/format";
import type { Timesheet } from "@/lib/api/types-timesheets";

/** Sunday that starts the week containing `iso` (timesheet weeks run Sunday–Saturday). */
export function timesheetWeekOf(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

/** Minutes → hours rounded to one decimal (8, 7.5, 0.3). */
export function minutesToHours(min: number | null | undefined): number {
  return Math.round(((min ?? 0) / 60) * 10) / 10;
}

/** Hours typed by a user → whole minutes (≥ 0). NaN for unparseable input. */
export function hoursToMinutes(hours: string): number {
  const n = Number(hours.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.round(n * 60);
}

/** Sheets a manager may approve or send back. */
export function isActionable(ts: Pick<Timesheet, "status">): boolean {
  return ts.status === "draft" || ts.status === "submitted";
}

/** The seven AD dates of the week starting `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
