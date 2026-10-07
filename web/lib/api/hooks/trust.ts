"use client";
/** Hooks for the trust area (docs/CONTRACT-ECOSYSTEM.md §1). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  Dispute,
  DisputeCreateInput,
  DisputeStatus,
  ProfileViewEntry,
  WorkerRatingInput,
  WorkerTrust,
} from "../types-trust";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const trustKeys = {
  orgDisputesAll: ["org", "disputes"] as const,
  orgDisputes: (q?: QueryParams) => ["org", "disputes", "list", q ?? {}] as const,
  opsDisputesAll: ["ops", "disputes"] as const,
  opsDisputes: (q?: QueryParams) => ["ops", "disputes", "list", q ?? {}] as const,
  opsDispute: (id: string) => ["ops", "disputes", "detail", id] as const,
  meTrust: ["me", "trust"] as const,
  meProfileViews: (q?: QueryParams) => ["me", "profile-views", q ?? {}] as const,
  meDisputes: ["me", "disputes"] as const,
};

// ---------------------------------------------------------------- employer
export function useOrgDisputes(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: trustKeys.orgDisputes(params),
    queryFn: () => api.get<Paginated<Dispute>>("/org/disputes", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRespondDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post<Dispute>(`/org/disputes/${id}/respond`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: trustKeys.orgDisputesAll }),
  });
}

// ---------------------------------------------------------------- ops
export function useOpsDisputes(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: trustKeys.opsDisputes(params),
    queryFn: () => api.get<Paginated<Dispute>>("/ops/disputes", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: Extract<DisputeStatus, "resolved" | "rejected">; note: string }) =>
      api.post<Dispute>(`/ops/disputes/${id}/resolve`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trustKeys.opsDisputesAll }),
  });
}

// ---------------------------------------------------------------- worker self-service (used by future worker web views)
export function useMyTrust(enabled = true) {
  return useQuery({
    queryKey: trustKeys.meTrust,
    queryFn: () => api.get<WorkerTrust>("/me/trust"),
    enabled,
  });
}

export function useMyProfileViews(params?: QueryParams) {
  return useQuery({
    queryKey: trustKeys.meProfileViews(params),
    queryFn: () => api.get<Paginated<ProfileViewEntry>>("/me/profile-views", params),
    placeholderData: keepPreviousData,
  });
}

export function useMyDisputes() {
  return useQuery({
    queryKey: trustKeys.meDisputes,
    queryFn: () => api.get<Paginated<Dispute>>("/me/disputes"),
  });
}

export function useRaiseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DisputeCreateInput) => api.post<Dispute>("/me/disputes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trustKeys.meDisputes }),
  });
}

export function useRateEmployer() {
  return useMutation({
    mutationFn: ({ employmentId, ...body }: WorkerRatingInput & { employmentId: string }) =>
      api.post(`/me/employments/${employmentId}/rate`, body),
  });
}
