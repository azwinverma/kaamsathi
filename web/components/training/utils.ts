import { toLatinDigits } from "@/lib/format";
import type { EnrollmentAttendance } from "@/lib/api/types-training";

/**
 * Percent (already 0–100) → "62.5%"-style text with at most `decimals` decimals; null when the
 * value is missing (suppressed / not enough data). Digits are Latin — localise at render time.
 */
export function formatPct(value: number | null | undefined, decimals = 1): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded}%`;
}

/** Enrollment attendance → "present/sessions (pct%)"; null when there are no sessions yet. */
export function attendanceSummary(a: EnrollmentAttendance | null | undefined): string | null {
  if (!a || !a.sessions) return null;
  const pct = formatPct(a.pct ?? (a.present * 100) / a.sessions, 0);
  return `${a.present}/${a.sessions}${pct ? ` (${pct})` : ""}`;
}

/** "09:30:00" → "09:30" for <input type="time">; "" for null. */
export function toTimeInput(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Parse a 0–100 integer percentage from a text input; null when invalid. */
export function parsePct(v: string): number | null {
  const s = toLatinDigits(v).trim();
  if (s === "") return 0;
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}
