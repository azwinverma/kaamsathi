/** Billing types: plans, subscriptions, VAT invoices, payments, credit notes. Workers never pay. */
import type { ISODate, ISODateTime, Money, UUID } from "./types";

export type PlanCode = "pilot" | "starter" | "growth" | "business" | "enterprise";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type PaymentMethod = "bank" | "cheque" | "esewa" | "khalti" | "cash" | "other";
export type BillingChargeKind =
  | "placement"
  | "subscription"
  | "verification_fee"
  | "training_commission"
  | "partner_referral_fee";

export const PLAN_CODES: PlanCode[] = ["pilot", "starter", "growth", "business", "enterprise"];
export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "issued", "paid", "void"];
export const PAYMENT_METHODS: PaymentMethod[] = ["bank", "cheque", "esewa", "khalti", "cash", "other"];

export interface BillingPlan {
  code: PlanCode;
  name: string;
  code_label: string;
  monthly_base: Money;
  per_active_worker: Money;
  min_monthly: Money;
  placement_fee: Money;
  included_workers: number;
  features: Record<string, unknown>;
  is_active: boolean;
}

export interface BillingSubscription {
  organization_id: UUID;
  organization_name: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  status_label: string;
  started_on: ISODate | null;
  started_on_bs: string | null;
  /** true when the org has no explicit subscription and is on the default pilot plan */
  is_default: boolean;
  active_workers: number;
  monthly_estimate: Money;
}

export interface InvoiceLine {
  id: number;
  kind: BillingChargeKind | "";
  kind_label: string | null;
  description: string;
  quantity: string;
  unit_price: Money;
  amount: Money;
  charge_id: UUID | null;
}

export interface InvoicePayment {
  id: UUID;
  amount: Money;
  method: PaymentMethod;
  method_label: string;
  reference: string;
  paid_on: ISODate;
  paid_on_bs: string;
  recorded_by: string | null;
  created_at: ISODateTime;
}

export interface CreditNote {
  id: UUID;
  number: string;
  amount: Money;
  vat_amount: Money;
  reason: string;
  issue_date: ISODate;
  issue_date_bs: string;
  created_at: ISODateTime;
}

export interface Invoice {
  id: UUID;
  number: string | null;
  fiscal_year: string | null;
  status: InvoiceStatus;
  status_label: string;
  payer_type: "organization" | "partner";
  organization_id: UUID | null;
  partner_id: UUID | null;
  buyer_name: string;
  period_bs_year: number | null;
  period_bs_month: number | null;
  issue_date: ISODate;
  issue_date_bs: string;
  due_date: ISODate;
  due_date_bs: string;
  subtotal: Money;
  vat_rate: string;
  vat_amount: Money;
  total: Money;
  paid_amount: Money;
  credited_amount: Money;
  balance_due: Money;
  created_at: ISODateTime;
  line_count?: number;
}

export interface InvoiceDetail extends Invoice {
  buyer_address: string;
  pan_of_buyer: string | null;
  notes: string;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  credit_notes: CreditNote[];
  void_reason: string | null;
}

export interface PlanInput {
  code?: PlanCode;
  name?: string;
  monthly_base?: Money;
  per_active_worker?: Money;
  min_monthly?: Money;
  placement_fee?: Money;
  included_workers?: number;
  is_active?: boolean;
}

export interface PaymentInput {
  amount: Money;
  method: PaymentMethod;
  reference?: string;
  paid_on: ISODate;
}
