/**
 * Booking status → timeline steps, tones and allowed Ghardhani actions (pure, unit-tested).
 * Main path: requested → accepted → on the way → arrived → working → completed → confirmed.
 */
import type { BookingEvent, BookingStatus } from "@/lib/api/types-bolau";

export const MAIN_PATH = [
  "requested",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "confirmed",
] as const satisfies readonly BookingStatus[];
export type MainStatus = (typeof MAIN_PATH)[number];

export const TERMINAL_OFF_PATH = ["declined", "expired", "cancelled", "no_show", "disputed"] as const;
export type OffPathStatus = (typeof TERMINAL_OFF_PATH)[number];

export type StepState = "done" | "current" | "todo" | "skipped";
export interface TimelineStep {
  status: MainStatus;
  state: StepState;
  at: string | null;
}
export interface Timeline {
  steps: TimelineStep[];
  /** Set when the booking left the main path (declined, cancelled …). */
  stoppedAt: OffPathStatus | null;
}

function isMain(s: string): s is MainStatus {
  return (MAIN_PATH as readonly string[]).includes(s);
}

export function bookingTimeline(status: BookingStatus, events: BookingEvent[] = []): Timeline {
  const when = new Map<string, string>();
  for (const e of events) if (!when.has(e.to_status) || e.at < (when.get(e.to_status) as string)) when.set(e.to_status, e.at);

  if (isMain(status)) {
    const idx = MAIN_PATH.indexOf(status);
    return {
      stoppedAt: null,
      steps: MAIN_PATH.map((s, i) => ({
        status: s,
        state: i < idx ? "done" : i === idx ? (s === "confirmed" ? "done" : "current") : "todo",
        at: when.get(s) ?? null,
      })),
    };
  }
  // Off the main path: everything reached (from events, at least "requested") is done, the rest skipped.
  let reached = 0;
  for (const e of events) if (isMain(e.to_status)) reached = Math.max(reached, MAIN_PATH.indexOf(e.to_status));
  return {
    stoppedAt: status as OffPathStatus,
    steps: MAIN_PATH.map((s, i) => ({
      status: s,
      state: i <= reached ? "done" : "skipped",
      at: when.get(s) ?? null,
    })),
  };
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "verified" | "accent";

export const BOOKING_TONE: Record<BookingStatus, Tone> = {
  requested: "warning",
  accepted: "brand",
  on_the_way: "info",
  arrived: "info",
  in_progress: "accent",
  completed: "verified",
  confirmed: "success",
  declined: "neutral",
  expired: "neutral",
  cancelled: "neutral",
  no_show: "danger",
  disputed: "danger",
};

export const ACTIVE_STATUSES: BookingStatus[] = ["requested", "accepted", "on_the_way", "arrived", "in_progress", "completed"];

/** The Ghardhani can cancel until the Sipalu has arrived. */
export function canCancel(status: BookingStatus): boolean {
  return status === "requested" || status === "accepted" || status === "on_the_way";
}

/** Phone numbers are exchanged only between acceptance and confirmation (+48 h, enforced by the API). */
export function contactWindow(status: BookingStatus): boolean {
  return ["accepted", "on_the_way", "arrived", "in_progress", "completed", "confirmed"].includes(status);
}

/** The arrival code matters from acceptance until the Sipalu has checked in with it. */
export function showArrivalCode(status: BookingStatus, code: string | null | undefined): boolean {
  return !!code && (status === "accepted" || status === "on_the_way");
}

export function canConfirm(status: BookingStatus): boolean {
  return status === "completed";
}

export function canReportNoShow(status: BookingStatus, scheduledStart: string, now: Date = new Date()): boolean {
  return (status === "accepted" || status === "on_the_way") && now.getTime() > Date.parse(scheduledStart) + 30 * 60_000;
}

export function canMarkPaid(status: BookingStatus, paidAt: string | null | undefined): boolean {
  return !paidAt && (status === "completed" || status === "confirmed");
}
