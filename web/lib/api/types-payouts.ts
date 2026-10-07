/** Types for the payouts area (docs/CONTRACT-ECOSYSTEM.md §6). */
import type { PaymentMethod, PayrollStatus, UUID } from "./types";

export type PayoutProvider = "bank_file" | "esewa" | "khalti" | "connectips";
export type PayoutBatchStatus =
  "draft" | "submitted" | "processing" | "completed" | "partially_failed" | "cancelled";
export type PayoutItemStatus = "pending" | "sent" | "paid" | "failed";

export interface PayoutExcluded {
  cash: number;
  other_method: number;
  already_batched: number;
  missing_details: number;
  paid: number;
}

export interface PayoutTotals {
  items: number;
  amount: string;
  paid_count: number;
  paid_amount: string;
  failed_count: number;
  pending_count: number;
  sent_count: number;
  excluded: Partial<PayoutExcluded>;
}

export interface PayoutItem {
  id: UUID;
  payslip_id: UUID;
  worker: { id: UUID; full_name: string };
  amount: string;
  method: PaymentMethod;
  account_name: string | null;
  account_no: string | null;
  account_no_masked: string | null;
  bank_name: string | null;
  wallet_id: string | null;
  status: PayoutItemStatus;
  status_label: string;
  provider_ref: string | null;
  failure_reason: string | null;
  updated_at: string;
}

export interface PayoutBatch {
  id: UUID;
  provider: PayoutProvider;
  provider_label: string;
  status: PayoutBatchStatus;
  status_label: string;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  totals: PayoutTotals;
  has_file: boolean;
  run: {
    id: UUID;
    bs_year: number;
    bs_month: number;
    month_name_en: string;
    month_name_ne: string;
    status: PayrollStatus;
  };
  created_by: { id: UUID; full_name: string } | null;
  items?: PayoutItem[];
  reconcile?: PayoutReconcileResult;
}

export interface PayoutReconcileResult {
  rows: number;
  paid: number;
  failed: number;
  unchanged: number;
  unmatched: number[];
}

export interface PayoutProviderOption {
  provider: PayoutProvider;
  label: string;
  enabled: boolean;
  eligible: number;
  amount: string;
  excluded: PayoutExcluded;
}

export interface RunPayoutOptions {
  run_id: UUID;
  run_status: PayrollStatus;
  providers: PayoutProviderOption[];
}

export interface PayoutItemMark {
  status: "sent" | "paid" | "failed";
  provider_ref?: string | null;
  failure_reason?: string | null;
}
