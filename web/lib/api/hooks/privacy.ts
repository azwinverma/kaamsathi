"use client";
/** Hooks for the privacy area (ops queue). Query keys live here (do not add them to keys.ts). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type {
  PrivacyRequest,
  PrivacyRequestFilters,
  PrivacyRequestPage,
  ProcessPrivacyRequestInput,
} from "../types-privacy";

export const privacyKeys = {
  all: ["privacy"] as const,
  opsRequestsAll: ["privacy", "ops", "requests"] as const,
  opsRequests: (f: PrivacyRequestFilters) => ["privacy", "ops", "requests", f] as const,
};

export function useOpsPrivacyRequests(filters: PrivacyRequestFilters) {
  return useQuery({
    queryKey: privacyKeys.opsRequests(filters),
    queryFn: ({ signal }) =>
      api.get<PrivacyRequestPage>(
        "/ops/privacy-requests",
        { status: filters.status, kind: filters.kind, page: filters.page },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useProcessPrivacyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, note }: ProcessPrivacyRequestInput) =>
      api.post<PrivacyRequest>(`/ops/privacy-requests/${id}/process`, {
        action,
        ...(note ? { note } : {}),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: privacyKeys.opsRequestsAll }),
  });
}
