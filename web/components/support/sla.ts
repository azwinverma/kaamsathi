/** SLA helpers for support cases (pure — unit tested). */
export type SlaTone = "overdue" | "soon" | "ok" | "paused" | "done";

export interface SlaState {
  tone: SlaTone;
  /** minutes until due (negative when overdue) */
  minutes: number;
}

const SOON_MINUTES = 120;

export function slaState(dueIso: string | null | undefined, status: string, now: number = Date.now()): SlaState {
  if (status === "resolved" || status === "closed") return { tone: "done", minutes: 0 };
  if (!dueIso) return { tone: "ok", minutes: 0 };
  const minutes = Math.round((new Date(dueIso).getTime() - now) / 60_000);
  if (status === "pending_user") return { tone: "paused", minutes };
  if (minutes < 0) return { tone: "overdue", minutes };
  if (minutes <= SOON_MINUTES) return { tone: "soon", minutes };
  return { tone: "ok", minutes };
}

/** Split a minute count into the largest two units: 3d 4h · 5h 10m · 12m. */
export function durationParts(totalMinutes: number): { d: number; h: number; m: number } {
  const abs = Math.abs(Math.round(totalMinutes));
  return { d: Math.floor(abs / 1440), h: Math.floor((abs % 1440) / 60), m: abs % 60 };
}

export function compactDuration(totalMinutes: number, units: { d: string; h: string; m: string }): string {
  const { d, h, m } = durationParts(totalMinutes);
  if (d > 0) return h > 0 ? `${d}${units.d} ${h}${units.h}` : `${d}${units.d}`;
  if (h > 0) return m > 0 ? `${h}${units.h} ${m}${units.m}` : `${h}${units.h}`;
  return `${m}${units.m}`;
}
