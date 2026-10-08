/** Types for the timesheets area (docs/CONTRACT-EXTENSIONS.md §4). */

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";
export type TimesheetDayStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday"
  | "weekly_off"
  | "not_marked"
  | "not_employed";

export interface TimesheetDay {
  date: string;
  worked_minutes: number;
  regular_minutes: number;
  overtime_minutes: number;
  status: TimesheetDayStatus;
}

export interface TimesheetUserRef {
  id: string;
  full_name: string;
}

export interface Timesheet {
  id: string;
  employment_id: string;
  worker: { id: string; full_name: string };
  designation: string;
  site: { id: string; name: string } | null;
  week_start: string;
  week_end: string;
  week_start_bs: string;
  status: TimesheetStatus;
  days: TimesheetDay[];
  regular_minutes: number;
  overtime_minutes_claimed: number;
  overtime_minutes_approved: number | null;
  over_cap: boolean;
  warning: string | null;
  submitted_by?: TimesheetUserRef | null;
  submitted_at: string | null;
  approved_by?: TimesheetUserRef | null;
  approved_at: string | null;
  note: string | null;
  updated_at: string | null;
  organization?: { id: string; name: string; name_ne: string | null };
}

export interface TimesheetPolicy {
  ot_requires_approval: boolean;
  weekly_ot_cap_minutes: number;
  daily_regular_minutes: number;
}

export interface TimesheetGenerateResult {
  week_start: string;
  created: number;
  refreshed: number;
  skipped: number;
}

export interface TimesheetBulkResult {
  approved: string[];
  skipped: { id: string; code: string }[];
}
