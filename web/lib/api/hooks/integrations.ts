"use client";
/** Hooks for the integrations area (docs/CONTRACT-EXTENSIONS.md §4). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { Paginated } from "../types";
import type {
  OrgApiKey,
  OrgApiKeyCreated,
  OrgApiKeyList,
  OrgApiScope,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEndpointList,
} from "../types-integrations";

export const integrationKeys = {
  keys: ["org", "api-keys"] as const,
  webhooks: ["org", "webhooks"] as const,
  webhook: (id: string) => ["org", "webhooks", id] as const,
  deliveries: (id: string, page: number) => ["org", "webhooks", id, "deliveries", page] as const,
};

export function useOrgApiKeys() {
  return useQuery({
    queryKey: integrationKeys.keys,
    queryFn: () => api.get<OrgApiKeyList>("/org/api-keys", { page_size: 100 }),
  });
}

export function useCreateOrgApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: OrgApiScope[] }) =>
      api.post<OrgApiKeyCreated>("/org/api-keys", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.keys }),
  });
}

export function useRevokeOrgApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<OrgApiKey>(`/org/api-keys/${id}/revoke`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.keys }),
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: integrationKeys.webhooks,
    queryFn: () => api.get<WebhookEndpointList>("/org/webhooks", { page_size: 100 }),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WebhookEndpointInput) => api.post<WebhookEndpoint>("/org/webhooks", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.webhooks }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<WebhookEndpointInput> & { id: string }) =>
      api.patch<WebhookEndpoint>(`/org/webhooks/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.webhooks }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.webhooks }),
  });
}

export function useRotateOrgWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<WebhookEndpoint>(`/org/webhooks/${id}/rotate-secret`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.webhooks }),
  });
}

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<WebhookDelivery>(`/org/webhooks/${id}/test`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: integrationKeys.webhook(id) });
      qc.invalidateQueries({ queryKey: integrationKeys.webhooks });
    },
  });
}

export function useWebhookDeliveries(id: string | null, page = 1) {
  return useQuery({
    queryKey: integrationKeys.deliveries(id ?? "", page),
    queryFn: () => api.get<Paginated<WebhookDelivery>>(`/org/webhooks/${id}/deliveries`, { page }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useRedeliverWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) =>
      api.post<WebhookDelivery>(`/org/webhooks/deliveries/${deliveryId}/redeliver`, {}),
    onSuccess: (d) => qc.invalidateQueries({ queryKey: integrationKeys.webhook(d.endpoint_id) }),
  });
}
