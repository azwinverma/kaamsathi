/** GET /org/employments/{id}/history (docs/CONTRACT-EXTENSIONS.md §8) — newest-first work record. */
import type { ContractAcceptChannel } from "./types-compliance";
import type { RatingCommentStatus } from "./types-moderation";
import type { EndReason, Money, UUID, WageType } from "./types";

type Change<T> = { from: T; to: T };
type SiteRef = { id: UUID; name: string } | null;

interface Base<T extends string, D> {
  type: T;
  /** ISO date for dated facts (start, end, advance) or ISO datetime. */
  at: string;
  at_bs: string;
  title: string;
  detail: D;
  actor: { id: UUID; full_name: string } | null;
}

export type WageField =
  | "wage_type"
  | "basic_salary"
  | "dearness_allowance"
  | "other_allowance"
  | "daily_wage"
  | "hourly_wage"
  | "part_time"
  | "ssf_enrolled";

interface DisputeDetail {
  id: UUID;
  kind: string;
  kind_label: string;
  status: string;
  status_label: string;
}

export type EmploymentHistoryEvent =
  | Base<"employment_started", { site: SiteRef; designation: string | null }>
  | Base<"employment_ended", { end_reason: EndReason | null; end_reason_label: string | null }>
  | Base<
      "wage_changed",
      {
        changes: Partial<Record<WageField, Change<string | boolean | null>>>;
        monthly_gross: Change<Money>;
        wage_type: Change<WageType> & { from_label: string; to_label: string };
      }
    >
  | Base<"site_changed", Change<SiteRef>>
  | Base<"designation_changed", Change<string | null>>
  | Base<
      "rating_given",
      {
        id: UUID;
        score_a: number;
        score_b: number;
        comment: string | null;
        comment_status: RatingCommentStatus;
        comment_status_label: string;
        voided: boolean;
      }
    >
  | Base<"contract_issued", { id: UUID; version: number; monthly_gross: Money | null }>
  | Base<"contract_accepted", { id: UUID; version: number; channel: ContractAcceptChannel | null }>
  | Base<"dispute_opened", DisputeDetail & { description: string }>
  | Base<
      "dispute_resolved",
      DisputeDetail & { appeal: boolean; note: string | null; outcome?: string | null }
    >
  | Base<
      "advance_given",
      {
        id: UUID;
        amount: Money;
        recover_per_month: Money;
        recovered_amount: Money;
        note: string | null;
      }
    >;

export type EmploymentHistoryType = EmploymentHistoryEvent["type"];
