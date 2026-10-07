/** Types for the training area — providers, courses, enrolments, shortages (docs/CONTRACT-ECOSYSTEM.md §4). */
import type { DistrictRef, ISODate, ISODateTime, Money, TradeRef, UUID } from "./types";

export type ProviderKind = "ctevt_affiliated" | "private" | "ngo" | "employer" | "government";
export type CourseLevel = "basic" | "level1" | "level2" | "level3" | "refresher";
export type CourseMode = "classroom" | "on_site" | "online";
export type CourseStatus = "open" | "closed" | "completed";
export type EnrollmentStatus = "applied" | "enrolled" | "completed" | "dropped" | "rejected";

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
