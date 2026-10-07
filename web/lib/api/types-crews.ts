/** Types for the crews area — naike (team lead) crews and referral rewards (docs/CONTRACT-ECOSYSTEM.md §2). */
import type { ISODate, ISODateTime, Money, UUID, WorkerCard } from "./types";
import type { WorkerTrustFields } from "./types-trust";

export type CrewReferralStatus = "pending" | "eligible" | "paid" | "void";

export interface CrewStats {
  members: number;
  placed_90d: number;
  earned_total: Money;
  pending_total: Money;
}

export type CrewMember = WorkerCard &
  WorkerTrustFields & {
    is_available: boolean;
    current_employer: { id: UUID; name: string } | null;
  };

export interface CrewSummary {
  id: UUID;
  name: string;
  is_active: boolean;
  created_at: ISODateTime;
  lead: WorkerCard & WorkerTrustFields;
  stats: CrewStats;
}

export interface CrewReferral {
  id: UUID;
  crew: { id: UUID; name: string };
  worker: { id: UUID; full_name: string; phone_masked: string };
  organization: { id: UUID; name: string };
  job: { id: UUID; title: string };
  employment_id: UUID | null;
  start_date: ISODate | null;
  start_date_bs: string | null;
  employment_status: "active" | "ended" | null;
  hold_until: ISODate | null;
  hold_until_bs: string | null;
  amount: Money;
  status: CrewReferralStatus;
  status_label: string;
  eligible_at: ISODateTime | null;
  paid_at: ISODateTime | null;
  payout_ref: string | null;
  void_reason: string | null;
  created_at: ISODateTime;
}

/** GET /me/crew (lead) and GET /ops/crews/{id} (ops adds `referrals`). */
export interface CrewDetail extends CrewSummary {
  members: CrewMember[];
  referrals?: CrewReferral[];
}

export interface CrewMemberInput {
  phone: string;
  full_name: string;
  trade: string;
  years_experience?: number;
}
