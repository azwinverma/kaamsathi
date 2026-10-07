"use client";
/** Hooks for the partners area (docs/CONTRACT-ECOSYSTEM.md §8). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  ConsentGrant,
  OpsPartner,
  OpsPartnerInput,
  PartnerAccessLogEntry,
  PartnerApiKey,
  PartnerApiKeyCreated,
  PartnerScope,
} from "../types-partners";

export const partnerKeys = {
  all: ["ops", "partners"] as const,
  list: (q?: QueryParams) => ["ops", "partners", "list", q ?? {}] as const,
  detail: (id: string) => ["ops", "partners", "detail", id] as const,
  keys: (id: string) => ["ops", "partners", "detail", id, "keys"] as const,
  accessLog: (id: string, q?: QueryParams) => ["ops", "partners", "detail", id, "access-log", q ?? {}] as const,
  grants: (id: string, q?: QueryParams) => ["ops", "partners", "detail", id, "grants", q ?? {}] as const,
};

export function useOpsPartners(params?: QueryParams) {
  return useQuery({
    queryKey: partnerKeys.list(params),
    queryFn: () => api.get<Paginated<OpsPartner>>("/ops/partners", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsPartner(id: string | null | undefined) {
  return useQuery({
    queryKey: partnerKeys.detail(id ?? ""),
    queryFn: () => api.get<OpsPartner>(`/ops/partners/${id}`),
    enabled: !!id,
  });
}

export function useCreateOpsPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpsPartnerInput) => api.post<OpsPartner>("/ops/partners", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.all }),
  });
}

export function useUpdateOpsPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<OpsPartnerInput> & { id: string }) =>
      api.patch<OpsPartner>(`/ops/partners/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.all }),
  });
}

export function useRotateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ webhook_secret: string }>(`/ops/partners/${id}/rotate-webhook-secret`),
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.all }),
  });
}

export function usePartnerKeys(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: partnerKeys.keys(partnerId ?? ""),
    queryFn: () => api.get<PartnerApiKey[]>(`/ops/partners/${partnerId}/keys`),
    enabled: !!partnerId,
  });
}

export function useCreatePartnerKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ partnerId, ...body }: { partnerId: string; scopes: PartnerScope[]; name?: string }) =>
      api.post<PartnerApiKeyCreated>(`/ops/partners/${partnerId}/keys`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.all }),
  });
}

export function useRevokePartnerKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ partnerId, keyId }: { partnerId: string; keyId: string }) =>
      api.post<PartnerApiKey>(`/ops/partners/${partnerId}/keys/${keyId}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.all }),
  });
}

export function usePartnerAccessLog(partnerId: string | null | undefined, params?: QueryParams) {
  return useQuery({
    queryKey: partnerKeys.accessLog(partnerId ?? "", params),
    queryFn: () => api.get<Paginated<PartnerAccessLogEntry>>(`/ops/partners/${partnerId}/access-log`, params),
    enabled: !!partnerId,
    placeholderData: keepPreviousData,
  });
}

export function usePartnerGrants(partnerId: string | null | undefined, params?: QueryParams) {
  return useQuery({
    queryKey: partnerKeys.grants(partnerId ?? "", params),
    queryFn: () => api.get<Paginated<ConsentGrant>>(`/ops/partners/${partnerId}/grants`, params),
    enabled: !!partnerId,
    placeholderData: keepPreviousData,
  });
}
