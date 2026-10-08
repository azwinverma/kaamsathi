/** Types for the support area — help desk cases with a message thread
 * (docs/CONTRACT-EXTENSIONS.md §2). */
import type { ISODateTime, UUID } from "./types";

export type SupportChannel = "app" | "web" | "phone" | "sms" | "field";
export type SupportCategory =
  "account" | "payment" | "attendance" | "job" | "privacy" | "technical" | "safety" | "other";
export type SafetyKind = "unsafe_workplace" | "harassment" | "payment_withholding" | "other";
export const SAFETY_KINDS: SafetyKind[] = [
  "unsafe_workplace",
  "harassment",
  "payment_withholding",
  "other",
];
export type IdentityMethod = "otp" | "security_questions";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportStatus = "open" | "pending_user" | "resolved" | "closed";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  "account",
  "payment",
  "attendance",
  "job",
  "privacy",
  "technical",
  "safety",
  "other",
];
export const SUPPORT_PRIORITIES: SupportPriority[] = ["urgent", "high", "normal", "low"];
export const SUPPORT_STATUSES: SupportStatus[] = ["open", "pending_user", "resolved", "closed"];

export interface SupportCase {
  id: UUID;
  number: string;
  /** Ops payloads carry the requester's phone; requester payloads a masked one. */
  requester: { id: UUID; full_name: string; phone?: string; phone_masked?: string };
  worker: { id: UUID; full_name: string } | null;
  organization: { id: UUID; name: string } | null;
  channel: SupportChannel;
  channel_label: string;
  category: SupportCategory;
  category_label: string;
  subject: string;
  description: string;
  priority: SupportPriority;
  priority_label: string;
  status: SupportStatus;
  status_label: string;
  /** Staff only (null for requesters). */
  assignee: { id: UUID; full_name: string } | null;
  sla_due_at: ISODateTime;
  overdue: boolean;
  first_response_at: ISODateTime | null;
  resolved_at: ISODateTime | null;
  escalated: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  last_message_at: ISODateTime | null;
  messages_count: number | null;
  safety_kind: SafetyKind | null;
  safety_kind_label: string | null;
  /** Safety reports: hidden from the employer unless ops shares the case. */
  confidential: boolean;
  anonymous: boolean;
  emergency: boolean;
  // ---- staff only
  shared_with_org?: boolean;
  dispute_id?: UUID | null;
  risk_flag_id?: UUID | null;
  identity_verified?: boolean;
  identity_verified_at?: ISODateTime | null;
  identity_method?: IdentityMethod | null;
  worker_phone?: string | null;
}

export interface CaseMessage {
  id: UUID;
  body: string;
  /** Internal notes are only ever returned to staff. */
  internal: boolean;
  from_staff: boolean;
  /** "phone" = contact-center call note (internal). */
  channel: SupportChannel;
  author: { id: UUID | null; full_name: string } | null;
  created_at: ISODateTime;
}

export interface SupportCaseInput {
  subject: string;
  description: string;
  category: SupportCategory;
  priority?: Exclude<SupportPriority, "urgent">;
  channel?: "app" | "web";
  safety_kind?: SafetyKind;
  anonymous?: boolean;
  emergency?: boolean;
  organization_id?: UUID | null;
}

export interface SupportCaseUpdateInput {
  id: UUID;
  assignee_id?: UUID | null;
  status?: SupportStatus;
  priority?: SupportPriority;
  shared_with_org?: boolean;
  dispute_id?: UUID | null;
  risk_flag_id?: UUID | null;
}

export interface WorkerSensitiveUpdateInput {
  phone?: string;
  payment_method?: "bank" | "esewa" | "khalti" | "cash";
  bank_name?: string;
  bank_account_no?: string;
  bank_account_name?: string;
  wallet_id?: string;
}

export interface SupportLookupResult {
  users: {
    id: UUID;
    full_name: string;
    phone: string;
    is_staff: boolean;
    preferred_language: string;
    date_joined: ISODateTime | null;
  }[];
  workers: {
    id: UUID;
    full_name: string;
    phone: string;
    verification_status: string;
    district: string | null;
    payment_method: string;
    has_user: boolean;
  }[];
  organizations: {
    id: UUID;
    name: string;
    role: string;
    user_id: UUID;
    verification_status: string;
  }[];
  open_cases: SupportCase[];
}

// ---------------------------------------------------------------- help center
export type HelpAudience = "worker" | "employer" | "all";
export type HelpCategory =
  | "getting_started"
  | "attendance"
  | "pay"
  | "verification"
  | "safety"
  | "privacy"
  | "hiring"
  | "compliance";
export const HELP_CATEGORIES: HelpCategory[] = [
  "getting_started",
  "attendance",
  "pay",
  "verification",
  "safety",
  "privacy",
  "hiring",
  "compliance",
];

export interface HelpArticle {
  id: UUID;
  slug: string;
  audience: HelpAudience;
  audience_label: string;
  category: HelpCategory;
  category_label: string;
  title_en: string;
  title_ne: string;
  body_en: string;
  body_ne: string;
  /** Localised from Accept-Language (falls back to English). */
  title: string;
  body: string;
  is_published: boolean;
  order: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  updated_by: { id: UUID; full_name: string } | null;
}

export type HelpArticleInput = Pick<
  HelpArticle,
  | "slug"
  | "audience"
  | "category"
  | "title_en"
  | "title_ne"
  | "body_en"
  | "body_ne"
  | "is_published"
  | "order"
>;

export type SupportScope = "org" | "me" | "ops";
