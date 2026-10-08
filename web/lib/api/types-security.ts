/** Types for the security area (docs/CONTRACT-EXTENSIONS.md §1). */
import type { ISODate, ISODateTime, Me, Paginated, UUID } from "./types";

export const STAFF_ROLES = [
  "verifier",
  "support",
  "finance_ops",
  "partner_manager",
  "risk_analyst",
  "superadmin",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// ---------------------------------------------------------------- login / MFA
/** `POST /auth/otp/verify` (via BFF) returns either the user or an MFA challenge. */
export interface MfaChallenge {
  mfa_required: true;
  mfa_token: string;
}
export type OtpVerifyResult = { user: Me } | MfaChallenge;

export function isMfaChallenge(r: unknown): r is MfaChallenge {
  return (
    !!r &&
    typeof r === "object" &&
    (r as { mfa_required?: unknown }).mfa_required === true &&
    typeof (r as { mfa_token?: unknown }).mfa_token === "string"
  );
}

export interface MfaVerifyInput {
  mfa_token: string;
  code?: string;
  recovery_code?: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauth_uri: string;
}
export interface MfaConfirmResponse {
  recovery_codes: string[];
}
export interface MfaDisableResponse {
  mfa_enabled: false;
}

// ---------------------------------------------------------------- sessions
export type SessionPlatform = "web" | "android" | "ios" | "other";
export interface SessionDevice {
  id: UUID;
  user_agent: string;
  ip: string | null;
  platform: SessionPlatform;
  created_at: ISODateTime;
  last_seen_at: ISODateTime;
  current: boolean;
}

// ---------------------------------------------------------------- audit
export interface AuditActor {
  id: UUID;
  full_name: string;
  phone: string;
}
export interface AuditEntry {
  id: UUID;
  seq: number;
  created_at: ISODateTime;
  actor: AuditActor | null;
  organization: { id: UUID; name: string } | null;
  action: string;
  object_type: string;
  object_id: string;
  changes: Record<string, unknown> | null;
  ip: string | null;
  hash: string;
}
export type AuditPage = Paginated<AuditEntry>;
export interface AuditFilters {
  actor?: string;
  organization?: string;
  action?: string;
  object_type?: string;
  object_id?: string;
  from?: ISODate;
  to?: ISODate;
  page?: number;
}
export interface AuditVerifyResult {
  ok: boolean;
  checked: number;
  first_broken_id: string | null;
}

// ---------------------------------------------------------------- staff
export interface StaffMember {
  id: UUID;
  phone: string;
  full_name: string;
  is_active: boolean;
  roles: StaffRole[];
  mfa_enabled: boolean;
  mfa_enrolled_at: ISODateTime | null;
  last_login: ISODateTime | null;
  date_joined: ISODateTime;
}
export type StaffPage = Paginated<StaffMember>;
export interface StaffCreateInput {
  phone: string;
  full_name: string;
  roles: StaffRole[];
}
export interface StaffUpdateInput {
  roles?: StaffRole[];
  is_active?: boolean;
}

// ---------------------------------------------------------------- system
export type HealthState = "ok" | "unavailable";
export interface SystemHealth {
  db: HealthState;
  redis: HealthState;
  celery: { queue_length: number | null; workers_seen: number | null };
  beat: { last_heartbeat: ISODateTime | null; stale: boolean };
  failed_tasks_24h: number;
  sms_failed_24h: number;
  version: string;
}
export const FAILED_TASK_STATUSES = ["open", "retried", "dismissed", "all"] as const;
export type FailedTaskStatus = (typeof FAILED_TASK_STATUSES)[number];
export interface FailedTask {
  id: UUID;
  task_name: string;
  task_id: string;
  args_redacted: unknown;
  exception: string;
  traceback: string;
  created_at: ISODateTime;
  retried_at: ISODateTime | null;
  dismissed_at: ISODateTime | null;
}
export type FailedTaskPage = Paginated<FailedTask>;

// ---------------------------------------------------------------- legal acceptance
export const LEGAL_KINDS = [
  "terms",
  "privacy",
  "worker_agreement",
  "employer_agreement",
  "marketing",
] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];
export interface PendingLegal {
  id: UUID;
  kind: LegalKind;
  version: string | number;
  url: string;
}
export interface LegalDocument extends PendingLegal {
  published_at: ISODateTime;
  summary_en: string | null;
  summary_ne: string | null;
}
export interface LegalAcceptResponse {
  accepted: PendingLegal[];
  pending_legal: PendingLegal[];
}
