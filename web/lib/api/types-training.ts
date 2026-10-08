/** Types for the training area — providers, courses, enrolments, shortages (docs/CONTRACT-ECOSYSTEM.md §4). */
import type { DistrictRef, ISODate, ISODateTime, Money, TradeRef, UUID } from "./types";

export type ProviderKind = "ctevt_affiliated" | "private" | "ngo" | "employer" | "government";
export type CourseLevel = "basic" | "level1" | "level2" | "level3" | "refresher";
export type CourseMode = "classroom" | "on_site" | "online";
export type CourseStatus = "open" | "closed" | "completed";
export type EnrollmentStatus = "applied" | "enrolled" | "completed" | "dropped" | "rejected";
/** T002 provider verification. */
export type ProviderVerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export const PROVIDER_VERIFICATION_STATUSES: ProviderVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "rejected",
];

export const PROVIDER_KINDS: ProviderKind[] = [
  "ctevt_affiliated",
  "private",
  "ngo",
  "employer",
  "government",
];
export const COURSE_LEVELS: CourseLevel[] = ["basic", "level1", "level2", "level3", "refresher"];
export const COURSE_MODES: CourseMode[] = ["classroom", "on_site", "online"];
export const COURSE_STATUSES: CourseStatus[] = ["open", "closed", "completed"];
export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "applied",
  "enrolled",
  "completed",
  "dropped",
  "rejected",
];

export interface TrainingProvider {
  id: UUID;
  name: string;
  name_ne: string | null;
  kind: ProviderKind;
  kind_label: string;
  ctevt_affiliation_no: string | null;
  district: DistrictRef;
  address: string | null;
  phone: string;
  email: string | null;
  partner: { id: UUID; name: string } | null;
  partner_id?: UUID | null;
  is_active: boolean;
  courses_count: number;
  created_at: ISODateTime;
  /** T002 — read-only; change via POST /ops/training/providers/{id}/verify. */
  verification_status?: ProviderVerificationStatus;
  verification_status_label?: string;
  verified_at?: ISODateTime | null;
  verified_by?: { id: UUID; full_name: string } | null;
  verification_note?: string | null;
}

export interface ProviderVerifyInput {
  status: "verified" | "rejected" | "pending";
  note?: string;
}

export interface ProviderInput {
  name: string;
  name_ne?: string | null;
  kind: ProviderKind;
  ctevt_affiliation_no?: string | null;
  district: string;
  address?: string | null;
  phone: string;
  email?: string | null;
  partner_id?: UUID | null;
  is_active?: boolean;
}

export interface ProviderRef {
  id: UUID;
  name: string;
  name_ne: string | null;
  kind: ProviderKind;
  kind_label: string;
  ctevt_affiliation_no: string | null;
  phone: string;
  district: DistrictRef;
  verification_status?: ProviderVerificationStatus;
  verified?: boolean;
}

export interface Course {
  id: UUID;
  provider: ProviderRef;
  provider_id?: UUID;
  trade: TradeRef;
  title: string;
  title_ne: string | null;
  description: string | null;
  level: CourseLevel;
  level_label: string;
  duration_days: number;
  fee: Money;
  sponsor_note: string | null;
  mode: CourseMode;
  mode_label: string;
  district: DistrictRef;
  starts_on: ISODate;
  starts_on_bs: string | null;
  seats: number;
  seats_taken: number;
  applied_count: number;
  status: CourseStatus;
  status_label: string;
  leads_to_nstb: boolean;
  /** T006: minimum % of sessions attended to complete (0 = no requirement). */
  min_attendance_pct?: number;
  /** True for the viewer's trades (worker) / workforce trades (employer) or top shortages. */
  recommended: boolean;
  created_at: ISODateTime;
}

export interface CourseInput {
  provider_id: UUID;
  trade: string;
  title: string;
  title_ne?: string | null;
  description?: string | null;
  level: CourseLevel;
  duration_days: number;
  fee: Money | string;
  sponsor_note?: string | null;
  mode: CourseMode;
  district: string;
  starts_on: ISODate;
  seats: number;
  status?: CourseStatus;
  leads_to_nstb?: boolean;
  min_attendance_pct?: number;
}

export interface CourseRef {
  id: UUID;
  title: string;
  title_ne: string | null;
  trade: TradeRef;
  level: CourseLevel;
  level_label: string;
  starts_on: ISODate;
  starts_on_bs: string | null;
  duration_days: number;
  fee: Money;
  provider: { id: UUID; name: string; name_ne: string | null };
  status: CourseStatus;
}

export interface Enrollment {
  id: UUID;
  status: EnrollmentStatus;
  status_label: string;
  applied_at: ISODateTime;
  completed_on: ISODate | null;
  completed_on_bs: string | null;
  updated_at: ISODateTime;
  worker: { id: UUID; full_name: string; phone?: string };
  course: CourseRef;
  sponsored_by_org: { id: UUID; name: string } | null;
  credential_id: UUID | null;
  /** T006 session attendance; `pct` is null when there are no sessions yet. */
  attendance?: EnrollmentAttendance;
}

export interface EnrollmentAttendance {
  sessions: number;
  present: number;
  pct: number | null;
}

/** T006 course session. Times are "HH:MM[:SS]". */
export interface TrainingSession {
  id: UUID;
  course_id: UUID;
  date: ISODate;
  date_bs: string;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
  present_count?: number;
  created_at: ISODateTime;
}

export interface SessionInput {
  date: ISODate;
  start_time?: string | null;
  end_time?: string | null;
  topic?: string | null;
}

export interface SessionAttendanceRow {
  enrollment_id: UUID;
  worker: { id: UUID; full_name: string };
  status: EnrollmentStatus;
  present: boolean | null;
}

export interface SessionAttendanceSheet {
  session: TrainingSession;
  rows: SessionAttendanceRow[];
}

/** T010 per-course outcomes; counts/rates < k are null; whole row null when `suppressed`. */
export interface CourseOutcome {
  course: CourseRef;
  enrolled: number | null;
  completed: number | null;
  placed_90d: number | null;
  retention_judged: number | null;
  retained_90d: number | null;
  /** Percent 0–100 with one decimal. */
  completion_rate: number | null;
  placement_rate: number | null;
  retention_rate: number | null;
  median_wage_before: Money | null;
  median_wage_after: Money | null;
  suppressed: boolean;
}

export interface OutcomesResponse {
  k_anonymity: number;
  placement_window_days: number;
  retention_days: number;
  courses: CourseOutcome[];
}

/** POST /org/enrollments → result */
export interface SponsorResult {
  created: Enrollment[];
  skipped: { worker_id: UUID; reason: string }[];
  /** Noted only — KaamSathi never charges the fee; the employer pays the provider directly. */
  fee_total: Money;
}

export interface ShortageRow {
  trade: TradeRef;
  demand: number;
  supply: number;
  shortage: number;
  open_jobs: number;
  /** joined / openings over the window (0–1); null when there were no openings. */
  fill_rate: number | null;
}

/** GET /ops/training/shortages */
export interface ShortagesResponse {
  district: string | null;
  days: number;
  results: ShortageRow[];
}
