import type { Advance, AttendanceStatus, Employment, LeaveRequest, MinimumWage, WageType } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/format";

/** Parse a money/number string the user typed (accepts Devanagari digits, commas). */
export function parseAmount(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = toLatinDigits(v).replace(/[,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalise user input into a 2dp decimal string for the API ("" → null). */
export function moneyOrNull(v: string | null | undefined): string | null {
  const n = parseAmount(v ?? null);
  return n === null ? null : n.toFixed(2);
}

/** Employment id from a LeaveRequest/Advance, where `employment` may be an id or an object. */
export function employmentIdOf(item: Pick<LeaveRequest | Advance, "employment" | "employment_id">): string {
  if (item.employment_id) return item.employment_id;
  const e = item.employment;
  return typeof e === "string" ? e : (e?.id ?? "");
}

/** Worker name from LeaveRequest/Advance (worker.full_name or worker_name), with optional lookup. */
export function workerNameOf(
  item: Pick<LeaveRequest | Advance, "worker" | "worker_name" | "employment">,
  lookup?: Map<string, Employment>,
): string {
  if (item.worker?.full_name) return item.worker.full_name;
  if (item.worker_name) return item.worker_name;
  const e = item.employment as unknown;
  if (e && typeof e === "object") {
    const obj = e as { worker?: { full_name?: string }; worker_name?: string; id?: string };
    if (obj.worker?.full_name) return obj.worker.full_name;
    if (obj.worker_name) return obj.worker_name;
    if (obj.id && lookup?.get(obj.id)) return lookup.get(obj.id)!.worker.full_name;
  }
  if (typeof e === "string" && lookup?.get(e)) return lookup.get(e)!.worker.full_name;
  return "";
}

export function designationOf(item: Pick<LeaveRequest, "employment">): string {
  const e = item.employment;
  return e && typeof e === "object" ? (e.designation ?? "") : "";
}

// ---------------------------------------------------------------- minimum wage
export interface WageValues {
  wage_type: WageType;
  basic_salary?: string;
  dearness_allowance?: string;
  daily_wage?: string;
}

export interface WageCheck {
  /** null = not enough input / min wage unknown */
  ok: boolean | null;
  amount: number | null;
  minimum: number | null;
}

/** Minimum-wage check: monthly basic+DA ≥ monthly_total; daily ≥ daily. */
export function checkMinimumWage(v: WageValues, mw: MinimumWage | undefined): WageCheck {
  if (!mw) return { ok: null, amount: null, minimum: null };
  if (v.wage_type === "monthly") {
    const b = parseAmount(v.basic_salary);
    const d = parseAmount(v.dearness_allowance) ?? 0;
    const min = parseAmount(mw.monthly_total);
    if (b === null || min === null) return { ok: null, amount: null, minimum: min };
    const amount = b + d;
    return { ok: amount >= min, amount, minimum: min };
  }
  const dw = parseAmount(v.daily_wage);
  const min = parseAmount(mw.daily);
  if (dw === null || min === null) return { ok: null, amount: null, minimum: min };
  return { ok: dw >= min, amount: dw, minimum: min };
}

// ---------------------------------------------------------------- attendance codes
export type MarkStatus = Extract<AttendanceStatus, "present" | "absent" | "half_day" | "leave">;
export const MARK_STATUSES: MarkStatus[] = ["present", "absent", "half_day", "leave"];

export const STATUS_LETTER: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  half_day: "H",
  leave: "L",
  holiday: "PH",
  weekly_off: "WO",
};

/** Solid (selected) style per status. */
export const STATUS_SOLID: Record<AttendanceStatus, string> = {
  present: "bg-success text-white border-success dark:text-neutral-900",
  absent: "bg-danger text-white border-danger dark:text-neutral-900",
  half_day: "bg-warning text-white border-warning dark:text-neutral-900",
  leave: "bg-brand text-brand-fg border-brand",
  holiday: "bg-surface-hover text-fg-body border-border",
  weekly_off: "bg-surface-hover text-fg-body border-border",
};

/** Tinted cell style per register code. */
export const CELL_TINT: Record<string, string> = {
  P: "bg-success-subtle text-success",
  A: "bg-danger-subtle text-danger",
  H: "bg-warning-subtle text-warning",
  L: "bg-brand-subtle text-brand-subtle-fg",
  PH: "bg-surface-hover text-fg-muted",
  WO: "bg-surface-hover text-fg-muted",
};

/** Message key (under the `workforce.attendance` namespace) for each register code. */
export const CODE_LABEL_KEY: Record<string, string> = {
  P: "code.P",
  A: "code.A",
  H: "code.H",
  L: "code.L",
  PH: "code.PH",
  WO: "code.WO",
};
