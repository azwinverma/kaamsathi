/** Types for trust operations: risk flags, employer verification (KYB), trade taxonomy
 * (docs/CONTRACT-EXTENSIONS.md §2). */
import type { DistrictRef, ISODateTime, TradeCategory, UUID } from "./types";

// ---------------------------------------------------------------- risk
export type RiskSubjectType =
  | "worker"
  | "organization"
  | "employment"
  | "attendance"
  | "credential"
  | "work_history"
  | "travel_document";
export type RiskKind =
  | "duplicate_identity"
  | "shared_bank_account"
  | "document_reuse"
  | "attendance_anomaly"
  | "geo_anomaly"
  | "velocity"
  | "reference_mismatch"
  | "manual";
export type RiskSeverity = "low" | "medium" | "high";
export type RiskFlagStatus = "open" | "confirmed" | "dismissed";

export const RISK_KINDS: RiskKind[] = [
  "duplicate_identity",
  "shared_bank_account",
  "document_reuse",
  "attendance_anomaly",
  "geo_anomaly",
  "velocity",
  "reference_mismatch",
  "manual",
];
export const RISK_SEVERITIES: RiskSeverity[] = ["high", "medium", "low"];
export const RISK_SUBJECT_TYPES: RiskSubjectType[] = [
  "worker",
  "organization",
  "employment",
  "attendance",
  "credential",
  "work_history",
  "travel_document",
];

export interface RiskPersonRef {
  worker_id: UUID;
  full_name: string;
}

/** Detector details: only ids and names, never plaintext identifiers. */
export interface RiskFlagDetails {
  reasons?: string[];
  matches?: RiskPersonRef[];
  worker?: RiskPersonRef;
  documents?: string[];
  organizations?: string[];
  events?: { date: string; distance_m: number }[];
  window_days?: number;
  note?: string;
  [key: string]: unknown;
}

export interface RiskFlag {
  id: UUID;
  subject_type: RiskSubjectType;
  subject_type_label: string;
  subject_id: string;
  subject: {
    label: string | null;
    worker_id: UUID | null;
    organization_id: UUID | null;
    link: string | null;
  };
  kind: RiskKind;
  kind_label: string;
  severity: RiskSeverity;
  severity_label: string;
  status: RiskFlagStatus;
  status_label: string;
  details: RiskFlagDetails;
  /** Localised reason sentences derived from details.reasons. */
  reasons: string[];
  note: string | null;
  created_by: { id: UUID; full_name: string } | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  resolved_by: { id: UUID; full_name: string } | null;
  resolved_at: ISODateTime | null;
}

export interface RiskCount<K extends string = string> {
  key: K;
  label: string;
  count: number;
}

export interface RiskSummary {
  open: number;
  open_high: number;
  created_30d: number;
  resolved_30d: number;
  confirmed_30d: number;
  by_kind: RiskCount<RiskKind>[];
  by_severity: RiskCount<RiskSeverity>[];
  by_status: RiskCount<RiskFlagStatus>[];
  by_subject_type: RiskCount<RiskSubjectType>[];
  trend: { date: string; created: number; resolved: number }[];
}

export interface ManualFlagInput {
  subject_type: RiskSubjectType;
  subject_id: string;
  severity: RiskSeverity;
  note: string;
}

export interface ResolveFlagInput {
  id: UUID;
  status: Exclude<RiskFlagStatus, "open">;
  note: string;
}

// ---------------------------------------------------------------- KYB
export type KybStatus = "unverified" | "pending" | "verified" | "rejected";

export interface OrgVerification {
  verification_status: KybStatus;
  verification_status_label: string;
  registration_no: string;
  /** Full PAN only in ops payloads. */
  pan_no: string | null;
  pan_no_masked: string;
  registration_doc_url: string | null;
  pan_doc_url: string | null;
  has_registration_doc: boolean;
  has_pan_doc: boolean;
  registration_doc_name: string | null;
  pan_doc_name: string | null;
  verified_at: ISODateTime | null;
  verification_note: string;
}

export interface KybSubmitInput {
  registration_no: string;
  pan_no?: string;
  registration_doc?: File | null;
  pan_doc?: File | null;
}

export interface OpsEmployer extends OrgVerification {
  id: UUID;
  name: string;
  name_ne: string | null;
  industry: string;
  industry_label: string;
  district: DistrictRef | null;
  municipality: string | null;
  address: string;
  phone: string;
  email: string | null;
  created_at: ISODateTime;
  is_active: boolean;
  members_count: number | null;
  active_workers: number | null;
  owner: { id: UUID; full_name: string; phone: string } | null;
  verified_by: { id: UUID; full_name: string } | null;
}

export interface EmployerVerifyInput {
  id: UUID;
  status: "verified" | "rejected";
  note?: string;
}

// ---------------------------------------------------------------- taxonomy
export const TRADE_CATEGORIES: TradeCategory[] = [
  "construction",
  "hospitality",
  "security",
  "healthcare",
  "manufacturing",
  "transport",
  "general",
];

export interface TaxonomyTrade {
  code: string;
  name_en: string;
  name_ne: string;
  category: TradeCategory;
  category_label: string;
  is_active: boolean;
  workers_count: number | null;
  jobs_count: number | null;
}

export interface TradeInput {
  code: string;
  name_en: string;
  name_ne: string;
  category: TradeCategory;
  is_active?: boolean;
}
