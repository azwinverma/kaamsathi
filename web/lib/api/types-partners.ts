/** Types for the partners area (docs/CONTRACT-ECOSYSTEM.md §8). */
import type { ISODateTime, UUID } from "./types";

export type PartnerKind =
  "bank" | "microfinance" | "insurer" | "wallet" | "training" | "recruitment_agency" | "government";
export type PartnerRegulator = "nrb" | "beema_samiti" | "dofe" | "ctevt" | "other";
export type PartnerScope =
  "profile.read" | "earnings.read" | "passport.read" | "mobility.read" | "referrals.write";
export type ConsentPurpose =
  "loan_assessment" | "insurance" | "ewa" | "recruitment" | "training" | "verification";
export type ConsentGrantStatus = "active" | "revoked" | "expired";

export const PARTNER_KINDS: PartnerKind[] = [
  "bank",
  "microfinance",
  "insurer",
  "wallet",
  "training",
  "recruitment_agency",
  "government",
];
export const PARTNER_REGULATORS: PartnerRegulator[] = [
  "nrb",
  "beema_samiti",
  "dofe",
  "ctevt",
  "other",
];
export const PARTNER_SCOPES: PartnerScope[] = [
  "profile.read",
  "earnings.read",
  "passport.read",
  "mobility.read",
  "referrals.write",
];

export interface PartnerRef {
  id: UUID;
  name: string;
}

export interface PartnerPublic extends PartnerRef {
  kind: PartnerKind;
  kind_label: string;
  regulator: PartnerRegulator | null;
  regulator_label: string | null;
  license_no: string | null;
}

/** /ops/partners */
export interface OpsPartner {
  id: UUID;
  name: string;
  kind: PartnerKind;
  kind_label: string;
  license_no: string;
  regulator: PartnerRegulator | "";
  regulator_label: string | null;
  contact_email: string;
  contact_phone: string;
  webhook_url: string;
  has_webhook_secret: boolean;
  is_active: boolean;
  created_at: ISODateTime;
  stats: {
    active_keys: number | null;
    active_grants: number | null;
    offers: number | null;
    referrals: number | null;
  };
  /** Only in the POST response (shown once). */
  webhook_secret?: string;
}

export interface OpsPartnerInput {
  name: string;
  kind: PartnerKind;
  license_no?: string;
  regulator?: PartnerRegulator | "";
  contact_email?: string;
  contact_phone?: string;
  webhook_url?: string;
  is_active?: boolean;
}

export interface PartnerApiKey {
  id: UUID;
  name: string;
  prefix: string;
  masked: string;
  scopes: PartnerScope[];
  created_at: ISODateTime;
  last_used_at: ISODateTime | null;
  revoked_at: ISODateTime | null;
  is_active: boolean;
}

/** POST /ops/partners/{id}/keys — `key` is returned exactly once. */
export interface PartnerApiKeyCreated extends PartnerApiKey {
  key: string;
}

export interface PartnerAccessLogEntry {
  id: UUID;
  partner: PartnerRef;
  endpoint: string;
  method: string;
  scope: PartnerScope | null;
  scope_label: string | null;
  status_code: number;
  granted: boolean;
  created_at: ISODateTime;
  /** ops view only */
  worker?: { id: UUID; full_name: string } | null;
  api_key_prefix?: string | null;
}

export interface ConsentGrant {
  id: UUID;
  purpose: ConsentPurpose;
  purpose_label: string;
  scopes: PartnerScope[];
  scope_labels: string[];
  granted_at: ISODateTime;
  expires_at: ISODateTime;
  revoked_at: ISODateTime | null;
  channel: "app" | "sms" | "ops";
  status: ConsentGrantStatus;
  status_label: string;
  partner?: PartnerPublic;
  worker?: { id: UUID; full_name?: string };
}
