/** Types for the experience area (docs/CONTRACT-EXTENSIONS.md §3 — worker growth). */
import type {
  Application,
  DistrictRef,
  ISODate,
  ISODateTime,
  Match,
  Stage,
  TradeRef,
  UUID,
  VerificationStatus,
  WageType,
} from "./types";

// ---------------------------------------------------------------- external work history
export const WORK_HISTORY_STATUSES = [
  "self_reported",
  "reference_pending",
  "verified",
  "unverifiable",
  "rejected",
] as const;
export type WorkHistoryStatus = (typeof WORK_HISTORY_STATUSES)[number];

export const WORK_HISTORY_METHODS = ["reference_call", "document", "employer_confirmed"] as const;
export type WorkHistoryMethod = (typeof WORK_HISTORY_METHODS)[number];

/** Ops decisions on a reference check. */
export const WORK_HISTORY_DECISIONS = ["verified", "unverifiable", "rejected"] as const;
export type WorkHistoryDecision = (typeof WORK_HISTORY_DECISIONS)[number];

/** Entry as the worker sees it (GET /me/work-history). */
export interface WorkHistoryEntry {
  id: UUID;
  employer_name: string;
  employer_org: { id: UUID; name: string; verification_status?: string | null } | null;
  trade: TradeRef | null;
  role_title: string;
  district: DistrictRef | null;
  start_date: ISODate;
  start_date_bs: string | null;
  end_date: ISODate | null;
  end_date_bs: string | null;
  months: number;
  description: string;
  reference_name: string | null;
  reference_phone: string | null;
  document_url: string | null;
  document_type: "pdf" | "image" | null;
  status: WorkHistoryStatus;
  status_label: string;
  verification_method: WorkHistoryMethod | null;
  verification_method_label: string | null;
  verified_at: ISODateTime | null;
  note: string | null;
  editable: boolean;
  created_at: ISODateTime;
}

/** Ops reference-check queue row (GET /ops/work-history). Reference phone is ops-only. */
export interface OpsWorkHistoryEntry extends WorkHistoryEntry {
  worker: { id: UUID; full_name: string; phone: string; verification_status: VerificationStatus };
  verified_by: { id: UUID; full_name: string } | null;
  updated_at: ISODateTime;
}

export interface VerifyWorkHistoryInput {
  status: WorkHistoryDecision;
  method?: WorkHistoryMethod | null;
  note?: string;
}

/** Employer confirmation request (GET /org/work-history-confirmations) — no reference details. */
export interface WorkHistoryConfirmation {
  id: UUID;
  employer_name: string;
  role_title: string;
  start_date: ISODate;
  start_date_bs: string | null;
  end_date: ISODate | null;
  end_date_bs: string | null;
  months: number;
  description: string;
  status: WorkHistoryStatus;
  status_label: string;
  verification_method: WorkHistoryMethod | null;
  verified_at: ISODateTime | null;
  created_at: ISODateTime;
  trade: TradeRef | null;
  district: DistrictRef | null;
  worker: { id: UUID; full_name: string; phone_masked: string; photo: string | null };
}

// ---------------------------------------------------------------- interest & responses
export type ApplicationSource = "ops" | "worker_interest" | "employer_invite";
export type WorkerResponse = "pending" | "interested" | "declined";

/** Fields the worker-growth extension adds to every Application payload. */
export interface ApplicationGrowthFields {
  source?: ApplicationSource;
  source_label?: string | null;
  worker_response?: WorkerResponse | null;
  worker_response_label?: string | null;
  responded_at?: ISODateTime | null;
}
export type ApplicationWithGrowth = Application & ApplicationGrowthFields;

/** Worker-facing job card (GET /me/jobs/recommended). */
export interface RecommendedJob {
  id: UUID;
  title: string;
  description: string;
  trade: TradeRef;
  wage_type: WageType;
  wage_amount: string;
  district: DistrictRef | null;
  food_provided: boolean;
  accommodation_provided: boolean;
  start_date: ISODate | null;
  start_date_bs: string | null;
  openings_count: number;
  shift: { id: UUID; name: string } | null;
  status: string;
  published_at: ISODateTime | null;
  organization: { id: UUID; name: string };
  employer_verified: boolean;
}

/** GET /me/applications row. */
export interface MyApplication {
  id: UUID;
  stage: Stage;
  stage_label: string;
  source: ApplicationSource;
  source_label: string;
  worker_response: WorkerResponse | null;
  worker_response_label: string | null;
  responded_at: ISODateTime | null;
  interview_at: ISODateTime | null;
  created_at: ISODateTime;
  stage_changed_at: ISODateTime;
  can_respond: boolean;
  job: RecommendedJob;
  organization: { id: UUID; name: string };
  employer_verified: boolean;
}

// ---------------------------------------------------------------- matching v2
export const MATCH_COMPONENTS = [
  "trade",
  "district",
  "preferred_district",
  "verified",
  "nstb",
  "experience",
  "reliability",
  "outcomes",
  "wage",
  "declined_before",
] as const;
export type MatchComponent = (typeof MATCH_COMPONENTS)[number];

export interface MatchV2 extends Match {
  explain?: Partial<Record<MatchComponent, number>>;
  interested?: boolean;
}

// ---------------------------------------------------------------- job offers (EMP-07)
export type JobOfferStatus = "sent" | "accepted" | "declined" | "expired" | "withdrawn";
export const CONTRACT_TYPES = ["permanent", "fixed_term", "daily", "probation"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export interface JobOfferSummary {
  id: UUID;
  application_id: UUID;
  status: JobOfferStatus;
  status_label: string;
  wage_type: WageType;
  basic_salary: string | null;
  dearness_allowance: string | null;
  daily_wage: string | null;
  start_date: ISODate;
  start_date_bs: string | null;
  site: { id: UUID; name: string } | null;
  designation: string;
  contract_type: ContractType;
  contract_type_label: string;
  ends_on: ISODate | null;
  ends_on_bs: string | null;
  expires_at: ISODateTime;
  created_at: ISODateTime;
  responded_at: ISODateTime | null;
  decline_reason: string | null;
}

/** Application payloads carry the latest offer (or null). */
export interface ApplicationOfferField {
  offer?: JobOfferSummary | null;
}

export interface OrgJobOffer extends JobOfferSummary {
  worker: { id: UUID; full_name: string };
  job: { id: UUID; title: string };
}

export interface MyJobOffer extends JobOfferSummary {
  job: RecommendedJob;
  organization: { id: UUID; name: string };
  employer_verified: boolean;
  monthly_amount: string;
}

export interface OfferInput {
  wage_type: WageType;
  basic_salary?: string | null;
  dearness_allowance?: string | null;
  daily_wage?: string | null;
  start_date: ISODate;
  site_id?: UUID | null;
  designation?: string;
  contract_type: ContractType;
  ends_on?: ISODate | null;
  expires_in_days?: number;
}

// ---------------------------------------------------------------- job alerts (SEARCH-02)
export type JobAlertCadence = "instant" | "daily" | "weekly";
export interface JobAlert {
  id: UUID;
  trade: TradeRef | null;
  districts: DistrictRef[];
  min_wage: string | null;
  frequency: JobAlertCadence;
  frequency_label: string;
  is_active: boolean;
  created_at: ISODateTime;
  last_sent_at: ISODateTime | null;
}
export interface JobAlertInput {
  trade?: string | null;
  districts?: string[];
  min_wage?: string | null;
  frequency?: JobAlertCadence;
  is_active?: boolean;
}
