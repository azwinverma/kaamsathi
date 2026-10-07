/** Types for the trust area (docs/CONTRACT-ECOSYSTEM.md §1). A "reliability score" — never a credit score. */
import type { ISODate, ISODateTime, UUID } from "./types";

/** 0 phone · 1 identity · 2 employment · 3 skills assessed · 4 certification · 5 highly trusted. */
export type VerificationLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Fields the backend adds to every WorkerCard (and ops WorkerDetail). */
export interface WorkerTrustFields {
  verification_level?: VerificationLevel | number;
  /** 0–100; null until the worker has at least one employment. */
  reliability_score?: number | null;
}

export type TrustBreakdownKey =
  | "employer_feedback"
  | "attendance"
  | "completion"
  | "skills"
  | "repeat_hiring"
  | "stability";

/** GET /me/trust */
export interface WorkerTrust {
  verification_level: VerificationLevel;
  verification_level_label: string;
  reliability_score: number | null;
  /** Each component 0–1. */
  breakdown: Record<TrustBreakdownKey, number | null>;
  next_steps: string[];
  computed_at?: ISODateTime | null;
}

export type ProfileViewContext = "application" | "employment" | "ops" | "partner" | "passport" | "crew";

/** GET /me/profile-views */
export interface ProfileViewEntry {
  id: UUID;
  organization: { id: UUID; name: string } | null;
  partner: { id: UUID; name: string } | null;
  context: ProfileViewContext;
  context_label: string;
  created_at: ISODateTime;
}

export type DisputeKind = "attendance" | "wage" | "employment_dates" | "rating" | "identity" | "other";
export type DisputeStatus = "open" | "employer_responded" | "resolved" | "rejected";

export interface Dispute {
  id: UUID;
  worker: { id: UUID; full_name: string; phone_masked: string };
  organization: { id: UUID; name: string } | null;
  employment: { id: UUID; designation: string } | null;
  payslip: { id: UUID; bs_year: number; bs_month: number } | null;
  attendance_date: ISODate | null;
  attendance_date_bs: string | null;
  kind: DisputeKind;
  kind_label: string;
  description: string;
  status: DisputeStatus;
  status_label: string;
  employer_note: string | null;
  resolution_note: string | null;
  raised_at: ISODateTime;
  responded_at: ISODateTime | null;
  resolved_by: { id: UUID; full_name: string } | null;
  resolved_at: ISODateTime | null;
}

export interface DisputeCreateInput {
  kind: DisputeKind;
  description: string;
  employment_id?: UUID | null;
  payslip_id?: UUID | null;
  attendance_date?: ISODate | null;
}

/** GET /ops/organizations/{id} → employer_reputation (null below 3 worker ratings). */
export interface EmployerReputation {
  pay_on_time_avg: number;
  conditions_avg: number;
  count: number;
}

/** POST /me/employments/{id}/rate */
export interface WorkerRatingInput {
  score_a: number;
  score_b: number;
  comment?: string;
}
