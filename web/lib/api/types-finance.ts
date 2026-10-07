/** Types for the finance area (docs/CONTRACT-ECOSYSTEM.md §9). We never lend or hold funds. */
import type { ISODateTime, Money, UUID } from "./types";
import type { PartnerPublic } from "./types-partners";

export type OfferKind = "loan" | "ewa" | "insurance" | "savings" | "tool_finance" | "vehicle_finance";
export type FinanceReferralStatus = "submitted" | "under_review" | "approved" | "rejected" | "disbursed" | "closed";

export const OFFER_KINDS: OfferKind[] = ["loan", "ewa", "insurance", "savings", "tool_finance", "vehicle_finance"];
export const FINANCE_REFERRAL_STATUSES: FinanceReferralStatus[] = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "disbursed",
  "closed",
];

/** Verified earnings summary (paid payslips only) — not a credit score. */
export interface FinancialProfile {
  worker_id: UUID;
  months_on_platform: number;
  verified_months: number;
  avg_monthly_net: Money;
  min_monthly_net: Money;
  max_monthly_net: Money;
  /** 0–1: 1 − coefficient of variation, floored at 0; null without data. */
  income_stability: number | null;
  employers_count: number;
  current_employment_months: number;
  ssf_months: number;
  last_payslip_month: string | null;
  monthly: { bs_year: number; bs_month: number; gross: Money; net: Money; employer: string; paid: boolean }[];
  basis: "paid_payslips";
  computed_at: ISODateTime | null;
}

export interface FinanceOffer {
  id: UUID;
  partner: PartnerPublic;
  kind: OfferKind;
  kind_label: string;
  title: string;
  title_ne: string | null;
  description: string;
  description_ne: string | null;
  min_verified_months: number;
  min_avg_net: Money | null;
  max_amount: Money | null;
  interest_note: string | null;
  offered_by_label: string;
  is_active: boolean;
}

export interface FinanceOfferInput {
  partner_id: UUID;
  kind: OfferKind;
  title: string;
  title_ne?: string;
  description?: string;
  description_ne?: string;
  min_verified_months: number;
  min_avg_net?: string | null;
  max_amount?: string | null;
  interest_note?: string;
  is_active?: boolean;
}

export interface FinanceReferral {
  id: UUID;
  offer: { id: UUID; kind: OfferKind; title: string; title_ne: string | null };
  amount_requested: Money | null;
  purpose_note: string | null;
  status: FinanceReferralStatus;
  status_label: string;
  partner_ref: string | null;
  amount_approved: Money | null;
  partner_note: string | null;
  grant_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  partner?: PartnerPublic;
  offered_by_label?: string;
  history?: { status: FinanceReferralStatus; at: ISODateTime; note: string }[];
  worker?: { id: UUID; full_name: string };
  partner_notified_at?: ISODateTime | null;
}

export interface FinanceSummary {
  total: number;
  by_status: { status: FinanceReferralStatus; status_label: string; count: number }[];
  by_partner: {
    partner: { id: UUID; name: string };
    total: number;
    open: number;
    approved: number;
    rejected: number;
    approval_rate: number | null;
    disbursed_total: Money;
  }[];
  by_kind: { kind: OfferKind; kind_label: string; total: number }[];
  approval_rate: number | null;
  disbursed_total: Money;
  active_offers: number;
  workers_with_verified_earnings: number;
  note: string;
}
