/** Types for the credentials area — credentials, skill assessments, Skill Passport (docs/CONTRACT-ECOSYSTEM.md §3). */
import type { DistrictRef, ISODate, ISODateTime, Money, NstbLevel, TradeRef, UUID } from "./types";

export type CredentialKind =
  "nstb" | "ctevt_training" | "training_course" | "license" | "safety" | "language" | "other";
export type CredentialStatus = "pending" | "verified" | "rejected" | "expired";
export type VerificationMethod = "document" | "issuer_registry" | "issuer_partner" | "ops_call";
export type AssessmentResult = "pass" | "fail";
export type SharePurpose = "job" | "recruitment_agency" | "bank" | "other";

export const CREDENTIAL_KINDS: CredentialKind[] = [
  "nstb",
  "ctevt_training",
  "training_course",
  "license",
  "safety",
  "language",
  "other",
];
export const VERIFICATION_METHODS: VerificationMethod[] = [
  "document",
  "ops_call",
  "issuer_partner",
  "issuer_registry",
];

export interface CredentialWorkerRef {
  id: UUID;
  full_name: string;
  phone?: string;
  verification_status?: string;
}

/** Worker-facing / ops credential. `document_url` is a short-lived signed URL (rewrite with mediaSrc). */
export interface Credential {
  id: UUID;
  kind: CredentialKind;
  kind_label: string;
  title: string;
  issuer: string;
  certificate_no: string | null;
  level: string | null;
  issued_on: ISODate | null;
  issued_on_bs: string | null;
  expires_on: ISODate | null;
  expires_on_bs: string | null;
  document_url: string | null;
  document_type: "pdf" | "image" | null;
  status: CredentialStatus;
  status_label: string;
  verification_method: VerificationMethod | null;
  verification_method_label: string | null;
  verified_at: ISODateTime | null;
  note: string | null;
  days_to_expiry: number | null;
  created_at: ISODateTime;
}

export interface OpsCredential extends Credential {
  worker: CredentialWorkerRef;
  verified_by: { id: UUID; full_name: string } | null;
}

/** GET /org/credentials/expiring?days= */
export interface ExpiringCredential {
  id: UUID;
  kind: CredentialKind;
  kind_label: string;
  title: string;
  issuer: string;
  level: string | null;
  expires_on: ISODate;
  expires_on_bs: string | null;
  status: CredentialStatus;
  status_label: string;
  days_to_expiry: number;
  worker: { id: UUID; full_name: string };
}

export interface VerifyCredentialInput {
  status: "verified" | "rejected";
  method: VerificationMethod;
  note?: string;
}

export interface SkillAssessment {
  id: UUID;
  worker: CredentialWorkerRef;
  trade: TradeRef;
  assessed_on: ISODate;
  assessed_on_bs: string | null;
  result: AssessmentResult;
  result_label: string;
  score: number | null;
  level: string | null;
  notes: string | null;
  assessor_user: { id: UUID; full_name: string } | null;
  assessor_partner: { id: UUID; name: string } | null;
  assessor_partner_id?: UUID | null;
  created_at: ISODateTime;
}

export interface AssessmentInput {
  worker_id: UUID;
  trade: string;
  assessed_on: ISODate;
  result: AssessmentResult;
  score?: number | null;
  level?: string;
  notes?: string;
  assessor_partner_id?: UUID | null;
}

/** GET /ops/workers/{id}/credentials */
export interface OpsWorkerCredentials {
  credentials: OpsCredential[];
  assessments: SkillAssessment[];
  passport: PassportSettings | null;
  active_shares: number;
}

// ---------------------------------------------------------------- passport

export interface PassportSettings {
  public_code: string;
  is_public: boolean;
  show_contact: boolean;
  updated_at: ISODateTime;
  public_url: string;
}

export interface PassportCredential {
  kind: CredentialKind;
  kind_label: string;
  title: string;
  issuer: string;
  level: string | null;
  certificate_no: string | null;
  issued_on: ISODate | null;
  issued_on_bs: string | null;
  expires_on: ISODate | null;
  expires_on_bs: string | null;
  verified: true;
}

/** Skill Passport payload (verified data only) — public, share links, PDF, partner API. */
export interface PassportPayload {
  name: string;
  name_ne: string | null;
  photo_url: string | null;
  trade_primary: TradeRef | null;
  districts: DistrictRef[];
  verification_level: number;
  reliability_score: number | null;
  identity: { citizenship: boolean; phone: boolean; address: boolean };
  skills: { trade: TradeRef; years: number; nstb_level: NstbLevel | null }[];
  assessments: {
    trade: TradeRef;
    level: string | null;
    assessed_on: ISODate;
    assessed_on_bs: string | null;
  }[];
  credentials: PassportCredential[];
  work: {
    verified_employers: number;
    total_months: number;
    completed_jobs: number;
    /** 0–1 over the last 180 days; null when fewer than 10 recorded days. */
    attendance_rate: number | null;
  };
  availability: { is_available: boolean; expected_monthly_wage: Money | null };
  contact?: { phone: string };
  verify_url: string;
  generated_at: ISODateTime;
  /** Present on share-link views only. */
  share?: { audience_label: string; purpose: SharePurpose; expires_at: ISODateTime };
}

/** GET /me/passport */
export interface MyPassport extends PassportSettings {
  payload: PassportPayload;
}

export interface PassportShare {
  id: UUID;
  audience_label: string;
  purpose: SharePurpose;
  purpose_label: string;
  include_contact: boolean;
  expires_at: ISODateTime;
  views: number;
  revoked_at: ISODateTime | null;
  created_at: ISODateTime;
  is_active: boolean;
  url: string;
}

export interface PassportShareInput {
  audience_label: string;
  purpose: SharePurpose;
  /** 1–90 */
  days: number;
  include_contact: boolean;
}
