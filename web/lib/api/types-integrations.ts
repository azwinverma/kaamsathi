/** Types for the integrations area (docs/CONTRACT-EXTENSIONS.md §4). */
import type { Paginated } from "./types";

export const ORG_API_SCOPES = [
  "jobs.read",
  "jobs.write",
  "workforce.read",
  "attendance.read",
  "attendance.write",
  "payroll.read",
  "timesheets.read",
] as const;
export type OrgApiScope = (typeof ORG_API_SCOPES)[number];

export const WEBHOOK_EVENTS = [
  "application.stage_changed",
  "employment.started",
  "employment.ended",
  "payroll.run_approved",
  "payroll.run_paid",
  "timesheet.approved",
  "dispute.raised",
  "support_case.updated",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface OrgApiKey {
  id: string;
  name: string;
  prefix: string;
  masked: string;
  scopes: OrgApiScope[];
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

export interface OrgApiKeyCreated extends OrgApiKey {
  /** The full key — returned once, never again. */
  key: string;
}

export interface OrgApiKeyList extends Paginated<OrgApiKey> {
  available_scopes: { code: OrgApiScope; label: string }[];
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: WebhookEvent[];
  is_active: boolean;
  secret_hint: string;
  /** Present on create, retrieve and rotate-secret only. */
  secret?: string;
  created_at: string;
  deliveries_7d?: number;
  failed_7d?: number;
  last_delivery_at?: string | null;
}

export interface WebhookEndpointList extends Paginated<WebhookEndpoint> {
  available_events: WebhookEvent[];
}

export interface WebhookEndpointInput {
  url: string;
  description?: string;
  events?: WebhookEvent[];
  is_active?: boolean;
}

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: WebhookEvent | "ping";
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  next_attempt_at: string | null;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

/**
 * Scope and event ids contain dots ("jobs.read"); next-intl treats dots as nesting, so their
 * message keys use underscores instead ("integrations.scope.jobs_read").
 */
export function messageKey(id: string): string {
  return id.replace(/\./g, "_");
}
