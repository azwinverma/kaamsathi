"use client";
/** In-app notification inbox (docs/CONTRACT-EXTENSIONS.md §4). Types and query keys live in this file. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { Paginated } from "../types";

export interface InboxNotification {
  id: string;
  kind: string;
  title: string;
  title_ne: string | null;
  body: string;
  body_ne: string | null;
  data: Record<string, unknown>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationKeys = {
  all: ["me", "notifications"] as const,
  list: ["me", "notifications", "list"] as const,
  unread: ["me", "notifications", "unread-count"] as const,
};

/** Unread badge count. Polls every minute while the tab is visible. */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => api.get<{ count: number }>("/me/notifications/unread-count"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled,
    retry: false,
  });
}

/** The latest page of the inbox (loaded when the dropdown opens). */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => api.get<Paginated<InboxNotification>>("/me/notifications", { page_size: 20 }),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InboxNotification>(`/me/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>("/me/notifications/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export type JobAlertFrequency = "instant" | "daily" | "weekly" | "off";

export interface NotificationPreferences {
  sms_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  marketing_opt_in: boolean;
  job_alert_frequency: JobAlertFrequency;
  /** "HH:MM" or null */
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const notificationPrefKeys = { prefs: ["me", "notification-preferences"] as const };

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationPrefKeys.prefs,
    queryFn: () => api.get<NotificationPreferences>("/me/notification-preferences"),
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>("/me/notification-preferences", body),
    onSuccess: (data) => qc.setQueryData(notificationPrefKeys.prefs, data),
  });
}

// ---------------------------------------------------------------- ops: templates + deliveries
export type NotificationChannel = "inapp" | "sms" | "push" | "email";

export interface NotificationTemplate {
  id: number;
  key: string;
  channel: NotificationChannel;
  language: "en" | "ne";
  version: number;
  subject: string;
  body: string;
  is_active: boolean;
  updated_at: string;
}

export type NotificationTemplateInput = Pick<
  NotificationTemplate,
  "key" | "channel" | "language" | "subject" | "body" | "is_active"
>;

export interface TemplatePreview {
  subject: string;
  body: string;
  missing: string[];
  length: number;
}

export interface OpsNotificationDelivery {
  id: string;
  kind: string;
  user: { id: string; phone: string };
  channel: NotificationChannel;
  status: "queued" | "sent" | "failed" | "skipped";
  attempts: number;
  provider_ref: string | null;
  error: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

export const opsNotificationKeys = {
  all: ["ops", "notifications"] as const,
  templates: (q: Record<string, string>) => ["ops", "notifications", "templates", q] as const,
  deliveries: (q: Record<string, string | number>) => ["ops", "notifications", "deliveries", q] as const,
};

export function useOpsNotificationTemplates(q: Record<string, string>) {
  return useQuery({
    queryKey: opsNotificationKeys.templates(q),
    queryFn: () => api.get<Paginated<NotificationTemplate>>("/ops/notifications/templates", { ...q, page_size: 100 }),
  });
}

export function useSaveNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<NotificationTemplateInput> & { id?: number }) =>
      id
        ? api.patch<NotificationTemplate>(`/ops/notifications/templates/${id}`, body)
        : api.post<NotificationTemplate>("/ops/notifications/templates", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsNotificationKeys.all }),
  });
}

export function usePreviewNotificationTemplate() {
  return useMutation({
    mutationFn: (body: { subject?: string; body?: string; context: Record<string, unknown> }) =>
      api.post<TemplatePreview>("/ops/notifications/templates/preview", body),
  });
}

export function useOpsNotificationDeliveries(q: Record<string, string | number>) {
  return useQuery({
    queryKey: opsNotificationKeys.deliveries(q),
    queryFn: () => api.get<Paginated<OpsNotificationDelivery>>("/ops/notifications/deliveries", q),
  });
}
