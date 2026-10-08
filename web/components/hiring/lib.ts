import type {
  Application,
  ApplicationDetail,
  MinimumWage,
  Stage,
  WageType,
  WorkerCard,
  WorkerProfile,
} from "@/lib/api/types";
import { todayIso, toLatinDigits } from "@/lib/format";

/** Active pipeline columns, in order. */
export const PIPELINE_STAGES = [
  "sourced",
  "shortlisted",
  "interview",
  "selected",
  "joined",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Terminal "closed" stages shown in the collapsed area. */
export const CLOSED_STAGES = ["rejected", "dropped"] as const;

export const ALL_STAGES: Stage[] = [...PIPELINE_STAGES, ...CLOSED_STAGES];

/** Allowed transitions (docs/CONTRACT.md → Hiring → move). */
export const TRANSITIONS: Record<Stage, Stage[]> = {
  sourced: ["shortlisted", "rejected"],
  shortlisted: ["interview", "selected", "rejected", "dropped"],
  interview: ["selected", "rejected", "dropped"],
  selected: ["joined", "dropped"],
  joined: [],
  rejected: [],
  dropped: [],
};

export function canMove(from: Stage, to: Stage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Stages that need extra input before moving. */
export const STAGES_WITH_DIALOG: Stage[] = ["interview", "rejected", "dropped", "joined"];

/** Parse user/API amount (accepts Devanagari digits and commas). Returns null if not a number. */
export function parseAmount(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = toLatinDigits(v).replace(/[,\s]/g, "");
  if (s === "" || !/^\d*(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalised decimal string with 2 places for the API. */
export function toMoneyString(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function minimumFor(mw: MinimumWage | undefined, wageType: WageType): number | null {
  if (!mw) return null;
  return parseAmount(
    wageType === "monthly" ? mw.monthly_total : wageType === "hourly" ? mw.hourly : mw.daily,
  );
}

/**
 * Split a monthly total into basic + DA using the minimum-wage ratio
 * (basic 12,170 : DA 7,380 of 19,550).
 */
export function splitMonthly(
  total: number,
  mw: MinimumWage | undefined,
): { basic: number; da: number } {
  const b = parseAmount(mw?.monthly_basic) ?? 12170;
  const t = parseAmount(mw?.monthly_total) ?? 19550;
  const basic = Math.round((total * b) / t);
  return { basic, da: Math.max(0, Math.round(total) - basic) };
}

/** Combine an AD date + "HH:MM" into an ISO datetime in Asia/Kathmandu (+05:45). */
export function ktmDateTime(dateIso: string, hhmm: string): string {
  const [h = "00", m = "00"] = hhmm.split(":");
  return `${dateIso}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00+05:45`;
}

/** AD date (Asia/Kathmandu) for an ISO datetime. */
export function ktmDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : todayIso(d);
}

/** Whole days elapsed since an ISO datetime (≥ 0). */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.floor((now - d) / 86_400_000));
}

/** Age in years from an AD date of birth. */
export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function isProfile(w: WorkerCard | WorkerProfile | undefined | null): w is WorkerProfile {
  return !!w && "history" in w && Array.isArray((w as WorkerProfile).history);
}

/** Name for `by` on stage events (object or string). */
export function actorName(by: unknown): string | null {
  if (!by) return null;
  if (typeof by === "string") return by;
  if (typeof by === "object" && by && "full_name" in by)
    return String((by as { full_name: unknown }).full_name ?? "");
  return null;
}

/** Patch an application inside any cached list/detail payload (for optimistic moves). */
export function patchApplicationCache<T>(data: T, id: string, patch: Partial<Application>): T {
  if (!data || typeof data !== "object") return data;
  const d = data as unknown as { results?: Application[]; id?: string };
  if (Array.isArray(d.results)) {
    if (!d.results.some((a) => a.id === id)) return data;
    return { ...d, results: d.results.map((a) => (a.id === id ? { ...a, ...patch } : a)) } as T;
  }
  if (d.id === id) return { ...(data as unknown as ApplicationDetail), ...patch } as T;
  return data;
}
