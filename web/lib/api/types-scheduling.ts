/** Types for the scheduling area (docs/CONTRACT-ECOSYSTEM.md §7). */
import type { ISODate, UUID } from "./types";

export interface RosterShift {
  id: UUID;
  name: string;
  start_time: string;
  end_time: string;
}

export interface RosterDay {
  date: ISODate;
  date_bs: string;
  weekday: number;
  is_holiday: boolean;
  holiday_name: string | null;
  is_weekly_off: boolean;
}

export interface RosterCell {
  shift_id: UUID | null;
  site_id: UUID | null;
  is_off: boolean;
  note?: string | null;
}

export interface RosterRow {
  employment_id: UUID;
  worker_name: string;
  designation: string;
  site_id: UUID | null;
  default_shift_id: UUID | null;
  start_date: ISODate;
  end_date: ISODate | null;
  cells: Record<ISODate, RosterCell | null>;
  /** O005: soft warnings per rostered (not-off) day — never blocks saving. */
  warnings?: Record<ISODate, RosterWarningCode[]>;
}

/** O005 roster warning codes. `conflict_elsewhere` never names the other employer. */
export type RosterWarningCode = "on_leave" | "holiday" | "weekly_off" | "conflict_elsewhere";

/** One warning from `PUT /org/roster`. */
export interface RosterWarning {
  employment_id: UUID;
  date: ISODate;
  code: RosterWarningCode;
  message: string;
}

export interface RosterWeek {
  week_start: ISODate;
  week_start_bs: string;
  week_end: ISODate;
  week_end_bs: string;
  days: RosterDay[];
  shifts: RosterShift[];
  rows: RosterRow[];
  /** O005: code → localized text. */
  warning_labels?: Partial<Record<RosterWarningCode, string>>;
}

export interface RosterEntryInput {
  employment_id: UUID;
  date: ISODate;
  shift_id?: UUID | null;
  site_id?: UUID | null;
  is_off: boolean;
  note?: string | null;
}

export interface RosterSaveResult {
  saved: number;
  cleared: number;
  warnings?: RosterWarning[];
  /** O007: workers sent a `roster_changed` notification. */
  notified_workers?: number;
}

export interface RosterCopyResult {
  copied: number;
  notified_workers?: number;
}

/** Attendance day view row addition (`rostered_shift`). */
export interface RosteredShift {
  id: UUID | null;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  shift_id: UUID | null;
  site_id: UUID | null;
  is_off: boolean;
}
