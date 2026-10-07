/** Types for the insights area (docs/CONTRACT-ECOSYSTEM.md §10). Aggregates only; cells covering
 * fewer than `k_anonymity` (5) workers come back as null with `suppressed: true`. */
import type { ISODate, ISODateTime, Money, UUID } from "./types";

export interface InsightsRef {
  code: string;
  name_en?: string;
  name_ne?: string;
}

export interface AnalyticsMonth {
  bs_year: number;
  bs_month: number;
  month: string;
  month_name_en: string;
  month_name_ne: string;
}

export interface OrgAnalytics {
  months: number;
  period_start: ISODate;
  period_end: ISODate;
  k_anonymity: number;
  headcount_trend: (AnalyticsMonth & { active: number; joined: number; left: number })[];
  active_now: number;
  attrition_rate: number | null;
  avg_tenure_months: number | null;
  time_to_fill_days_avg: number | null;
  time_to_shortlist_hours_avg: number | null;
  attendance_rate_trend: (AnalyticsMonth & { rate: number | null; workers: number | null; suppressed: boolean })[];
  overtime_hours_trend: (AnalyticsMonth & { hours: number | null; workers: number | null; suppressed: boolean })[];
  wage_bill_trend: (AnalyticsMonth & {
    gross: Money | null;
    net: Money | null;
    employer_cost: Money | null;
    run_status: string | null;
    workers: number | null;
    suppressed: boolean;
  })[];
  hires: number;
  cost_per_hire: Money | null;
  absenteeism_by_site: {
    site: { id: UUID; name: string } | null;
    absence_rate: number | null;
    absent_days: number | null;
    workers: number | null;
    suppressed: boolean;
  }[];
  /** weekday 0 = Sunday */
  top_absence_weekdays: { weekday: number; absences: number; absence_rate: number | null }[];
}

export interface InsightsWageBand {
  trade: InsightsRef;
  district: InsightsRef;
  median_monthly: Money | null;
  p25: Money | null;
  p75: Money | null;
  sample: number | null;
  suppressed: boolean;
}

export interface InsightsDemandRow {
  trade: InsightsRef;
  open_jobs: number;
  open_positions: number;
  filled_90d: number;
  avg_days_to_fill: number | null;
}

export interface InsightsSupplyRow {
  trade: InsightsRef;
  registered: number | null;
  verified: number | null;
  available: number | null;
  suppressed: boolean;
}

/** From the training shortage engine. */
export interface InsightsShortageRow {
  trade: InsightsRef | string;
  demand: number;
  supply: number;
  shortage: number;
  fill_rate?: number | null;
  [key: string]: unknown;
}

export interface InsightsUpliftRow {
  kind_or_level: string;
  median_net_with: Money | null;
  median_net_without: Money | null;
  uplift_pct: number | null;
  sample: number | null;
  suppressed: boolean;
}

export interface InsightsOriginRow {
  /** null = small districts pooled together */
  district: InsightsRef | null;
  workers: number;
  suppressed: boolean;
}

export interface LabourMarket {
  filters: { district: string | null; trade: string | null };
  k_anonymity: number;
  wages: InsightsWageBand[];
  demand: InsightsDemandRow[];
  supply: InsightsSupplyRow[];
  shortages: InsightsShortageRow[];
  certification_uplift: InsightsUpliftRow[];
  origin_districts: InsightsOriginRow[];
  generated_at: ISODateTime;
}

export type InsightsReport =
  | "wages"
  | "demand"
  | "supply"
  | "shortages"
  | "certification_uplift"
  | "origin_districts";
