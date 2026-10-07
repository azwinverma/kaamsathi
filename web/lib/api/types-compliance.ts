/** Types for the compliance area (docs/CONTRACT-ECOSYSTEM.md §5). */
import type { ISODate, PayrollStatus, TradeRef, UUID } from "./types";

export type ContractLanguage = "en" | "ne" | "both";
export type ContractAcceptChannel = "app" | "sms" | "paper";

export interface ContractTerms {
  designation: string | null;
  site_name: string | null;
  wage_type: "monthly" | "daily";
  basic_salary: string | null;
  dearness_allowance: string | null;
  other_allowance: string | null;
  daily_wage: string | null;
  monthly_gross: string | null;
  ssf_enrolled: boolean;
  start_date: ISODate;
  start_date_bs: string;
}

export interface EmploymentContract {
  id: UUID;
  employment_id: UUID;
  version: number;
  generated_at: string;
  language: ContractLanguage;
  accepted_at: string | null;
  accepted_channel: ContractAcceptChannel | null;
  is_accepted: boolean;
  terms: ContractTerms;
  generated_by: { id: UUID; full_name: string } | null;
}

export interface EmploymentContractState {
  employment_id: UUID;
  latest: EmploymentContract | null;
  versions: EmploymentContract[];
  needs_new_version: boolean;
}

export type SSFFilingStatus = "prepared" | "submitted" | "acknowledged";

export interface SSFFiling {
  id: UUID;
  status: SSFFilingStatus;
  status_label: string;
  due_date: ISODate;
  due_date_bs: string;
  prepared_at: string;
  submitted_on: ISODate | null;
  submitted_on_bs: string | null;
  receipt_no: string | null;
  note: string | null;
  summary: {
    rows: number;
    missing: number;
    basic: string;
    employee_11: string;
    employer_20: string;
    total_31: string;
  };
  updated_at: string;
  is_overdue: boolean;
  run: {
    id: UUID;
    bs_year: number;
    bs_month: number;
    month_name_en: string;
    month_name_ne: string;
    status: PayrollStatus;
  };
  prepared_by: { id: UUID; full_name: string } | null;
}

export interface SSFFilingUpdate {
  status?: SSFFilingStatus;
  submitted_on?: ISODate | null;
  receipt_no?: string | null;
  note?: string | null;
}

export type ComplianceItemKey =
  | "ssf_employer_registered"
  | "workers_missing_ssf_id"
  | "ssf_filings_overdue"
  | "below_minimum_wage"
  | "contracts_missing"
  | "contracts_unaccepted"
  | "attendance_unmarked_7d"
  | "payroll_not_run_last_month"
  | "credentials_expiring";

export type ComplianceItemStatus = "ok" | "warning" | "action";

export interface ComplianceItem {
  key: ComplianceItemKey;
  status: ComplianceItemStatus;
  count: number;
  message: string;
  link: string;
}

export interface ComplianceStatus {
  score: number;
  items: ComplianceItem[];
}

export interface Contractor {
  id: UUID;
  name: string;
  pan_no: string | null;
  phone: string;
  trades: TradeRef[];
  lead_worker: { id: UUID; full_name: string; phone: string } | null;
  is_active: boolean;
  created_at: string;
  active_workers: number;
}

export interface ContractorInput {
  name: string;
  phone: string;
  pan_no?: string | null;
  trades?: string[];
  lead_worker_id?: UUID | null;
  is_active?: boolean;
}

export interface ContractorSummary {
  contractor: { id: UUID; name: string };
  bs_year: number;
  bs_month: number;
  month_name_en: string;
  month_name_ne: string;
  headcount: number;
  days: string;
  wages: { gross: string; net: string; employer_cost: string } | null;
  payroll_run: { id: UUID; status: PayrollStatus } | null;
  workers: {
    employment_id: UUID;
    worker_name: string;
    designation: string;
    days: string;
    gross_pay: string | null;
    net_pay: string | null;
  }[];
}
