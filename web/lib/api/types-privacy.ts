/** Types for the privacy area (docs/CONTRACT-ECOSYSTEM.md §11). */
import type { Paginated } from "./types";

export type PrivacyRequestKind = "export" | "correction" | "deletion";
export type PrivacyRequestStatus = "received" | "in_progress" | "completed" | "rejected";
export type PrivacyProcessAction = "approve" | "reject";

export const PRIVACY_REQUEST_KINDS: readonly PrivacyRequestKind[] = [
  "export",
  "correction",
  "deletion",
];
export const PRIVACY_REQUEST_STATUSES: readonly PrivacyRequestStatus[] = [
  "received",
  "in_progress",
  "completed",
  "rejected",
];

export interface PrivacyRequest {
  id: string;
  kind: PrivacyRequestKind;
  kind_label: string;
  status: PrivacyRequestStatus;
  status_label: string;
  details: string | null;
  response_note: string | null;
  created_at: string;
  completed_at: string | null;
  file_available: boolean;
  file_expires_at: string | null;
  download_url: string | null;
  worker: { id: string; full_name: string; phone_masked: string } | null;
  user: { id: string; full_name: string; phone: string } | null;
  handled_by: { id: string; full_name: string } | null;
}

export type PrivacyRequestPage = Paginated<PrivacyRequest>;

export interface PrivacyRequestFilters {
  status?: PrivacyRequestStatus | "";
  kind?: PrivacyRequestKind | "";
  page?: number;
}

export interface ProcessPrivacyRequestInput {
  id: string;
  action: PrivacyProcessAction;
  note?: string;
}
