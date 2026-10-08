/**
 * Types for the mobility & intelligence area (docs/CONTRACT-EXTENSIONS.md §5): foreign-employment
 * documents, licensed agencies, recruitment shares, district heatmap, platform KPIs, career.
 */
import type { Paginated } from "./types";

export type MobilityKindGroup = "travel" | "clearance";
export type TravelKind = "passport" | "labour_permit" | "visa";
export type ClearanceKind =
  | "police_clearance"
  | "medical_fitness"
  | "pre_departure_orientation"
  | "insurance"
  | "language_test";
export type MobilityKind = TravelKind | ClearanceKind;
export type MobilityDocStatus = "pending" | "verified" | "rejected" | "expired";
export type AgencyComplianceStatus = "unverified" | "verified" | "suspended";

export const MOBILITY_DOC_STATUSES: MobilityDocStatus[] = [
  "pending",
  "verified",
  "rejected",
  "expired",
];
export const AGENCY_COMPLIANCE_STATUSES: AgencyComplianceStatus[] = [
  "unverified",
  "verified",
  "suspended",
];

/** Returned with every worker-facing mobility response (literal en + ne strings). */
export interface SafetyGuidance {
  title_en: string;
  title_ne: string;
  en: string[];
  ne: string[];
  dofe_url: string;
}

export interface MobilityDocument {
  id: string;
  kind_group: MobilityKindGroup;
  kind_group_label: string;
  kind: MobilityKind;
  kind_label: string;
  title: string;
  issuer: string | null;
  issuing_country: string | null;
  number_masked: string | null;
  score_or_level: string | null;
  issued_on: string | null;
  issued_on_bs: string | null;
  expires_on: string | null;
  expires_on_bs: string | null;
  days_to_expiry: number | null;
  status: MobilityDocStatus;
  status_label: string;
  note: string | null;
  verified_at: string | null;
  /** Short-lived signed URL (owner + staff only). */
  document_url: string | null;
  document_type: "pdf" | "image" | null;
  created_at: string;
}

export interface OpsMobilityDocument extends MobilityDocument {
  /** Full number — ops only. */
  number: string | null;
  worker: { id: string; full_name: string; phone: string; verification_status: string };
  verified_by: { id: string; full_name: string } | null;
  /** Another worker holds a document with the same number. */
  duplicate_number: boolean;
}

export interface VerifyMobilityDocumentInput {
  status: "verified" | "rejected";
  note?: string;
}

export interface Agency {
  id: string;
  name: string;
  license_no: string | null;
  license_valid_until: string | null;
  license_valid_until_bs: string | null;
  regulator: string | null;
  regulator_label: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface OpsAgency extends Agency {
  is_active: boolean;
  compliance_status: AgencyComplianceStatus;
  compliance_status_label: string;
  compliance_verified_at: string | null;
  compliance_verified_by: { id: string; full_name: string } | null;
  compliance_note: string | null;
  license_valid: boolean;
  license_days_left: number | null;
  /** Verified + unexpired licence + active → may receive worker shares. */
  eligible: boolean;
  active_shares: number | null;
}

export interface AgencyComplianceInput {
  status: AgencyComplianceStatus;
  license_valid_until?: string | null;
  license_no?: string;
  note?: string;
}

export type WithSafety<T> = T & { safety_guidance: SafetyGuidance };
export type MobilityList<T> = WithSafety<Paginated<T>>;

// ------------------------------------------------------------------ heatmap
export type HeatmapMetric = "demand" | "supply" | "shortage" | "median_wage";
export const HEATMAP_METRICS: HeatmapMetric[] = ["demand", "supply", "shortage", "median_wage"];

export interface HeatmapCell {
  district: {
    code: string;
    name_en: string;
    name_ne: string;
    province: { code: number; name_en: string; name_ne: string };
  };
  /** Count for demand/supply/shortage; money string for median_wage; null = no data or suppressed. */
  value: number | string | null;
  sample: number | null;
  suppressed: boolean;
}

export interface Heatmap {
  metric: HeatmapMetric;
  trade: { code: string; name_en: string; name_ne: string } | null;
  k_anonymity: number;
  min: number | null;
  max: number | null;
  cells: HeatmapCell[];
  generated_at: string;
}

// ------------------------------------------------------------------ KPIs
export type KpiPeriod = 30 | 90 | 365;
export const KPI_PERIODS: KpiPeriod[] = [30, 90, 365];

export type Phase1ExitKey =
  "workers" | "organizations" | "paying_organizations" | "placements" | "median_fill_days";

export interface Phase1ExitRow {
  key: Phase1ExitKey;
  target: number;
  actual: number | null;
  /** gte: actual ≥ target to meet; lt: actual < target to meet. */
  comparator: "gte" | "lt";
  met: boolean;
}

export interface Kpis {
  days: number;
  period_start: string;
  period_end: string;
  time_to_fill_days_median: number | null;
  time_to_shortlist_hours_median: number | null;
  /** 0–1 */
  fill_rate: number | null;
  placements: number;
  placement_revenue: string;
  repeat_employer_rate: number | null;
  worker_activation_rate: number | null;
  verified_workers_added: number;
  dispute_rate: number | null;
  avg_employer_rating_of_workers: number | null;
  avg_worker_rating_of_employers: number | null;
  phase1_exit: Phase1ExitRow[];
  phase1_exit_met: boolean;
  generated_at: string;
}

// ------------------------------------------------------------------ career (/me/career)
export interface CareerRecommendation {
  kind: "credential" | "course" | "skill" | "profile";
  key: string;
  title: string;
  title_ne: string;
  reason: string;
  reason_ne: string;
  expected_uplift_pct: number | null;
  course_id?: string;
  /** App deep link, e.g. ks://profile, ks://courses/<id>. */
  link?: string | null;
}

export interface Career {
  trades: {
    code: string;
    name_en: string;
    name_ne: string;
    years_experience: number;
    nstb_level: string;
  }[];
  district: string | null;
  recommendations: CareerRecommendation[];
  generated_at: string;
}
