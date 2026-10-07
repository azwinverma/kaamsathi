"use client";
/** Hooks for the crews area — naike crews and referral rewards (docs/CONTRACT-ECOSYSTEM.md §2). Query keys live here. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type { CrewDetail, CrewMember, CrewMemberInput, CrewSummary, CrewReferral } from "../types-crews";

export const crewKeys = {
  opsAll: ["ops", "crews"] as const,
  opsCrews: (q?: QueryParams) => ["ops", "crews", "list", q ?? {}] as const,
  opsCrew: (id: string) => ["ops", "crews", "detail", id] as const,
  opsReferralsAll: ["ops", "referrals"] as const,
  opsReferrals: (q?: QueryParams) => ["ops", "referrals", "list", q ?? {}] as const,
  meCrew: ["me", "crew"] as const,
  meReferrals: (q?: QueryParams) => ["me", "crew", "referrals", q ?? {}] as const,
};

// ---------------------------------------------------------------- ops
export function useOpsCrews(params?: QueryParams) {
  return useQuery({
    queryKey: crewKeys.opsCrews(params),
    queryFn: () => api.get<Paginated<CrewSummary>>("/ops/crews", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsCrew(id: string | undefined | null) {
  return useQuery({
    queryKey: crewKeys.opsCrew(id ?? ""),
    queryFn: () => api.get<CrewDetail>(`/ops/crews/${id}`),
    enabled: !!id,
  });
}

export function useOpsReferrals(params?: QueryParams) {
  return useQuery({
    queryKey: crewKeys.opsReferrals(params),
    queryFn: () => api.get<Paginated<CrewReferral>>("/ops/referrals", params),
    placeholderData: keepPreviousData,
  });
}

function useReferralMutation<TBody>(path: (id: string) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TBody & { id: string }) => api.post<CrewReferral>(path(id), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewKeys.opsReferralsAll });
      qc.invalidateQueries({ queryKey: crewKeys.opsAll });
    },
  });
}

export function useMarkReferralPaid() {
  return useReferralMutation<{ payout_ref: string }>((id) => `/ops/referrals/${id}/mark-paid`);
}

export function useVoidReferral() {
  return useReferralMutation<{ reason: string }>((id) => `/ops/referrals/${id}/void`);
}

// ---------------------------------------------------------------- naike self-service (mobile-first; web hooks for parity)
export function useMyCrew(enabled = true) {
  return useQuery({
    queryKey: crewKeys.meCrew,
    queryFn: () => api.get<CrewDetail>("/me/crew"),
    enabled,
    retry: false,
  });
}

export function useCreateCrew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => api.post<CrewDetail>("/me/crew", body),
    onSuccess: (crew) => qc.setQueryData(crewKeys.meCrew, crew),
  });
}

export function useAddCrewMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CrewMemberInput) => api.post<CrewMember>("/me/crew/members", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: crewKeys.meCrew }),
  });
}

export function useRemoveCrewMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId: string) => api.delete(`/me/crew/members/${workerId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: crewKeys.meCrew }),
  });
}

export function useMyCrewReferrals(params?: QueryParams) {
  return useQuery({
    queryKey: crewKeys.meReferrals(params),
    queryFn: () => api.get<Paginated<CrewReferral>>("/me/crew/referrals", params),
    placeholderData: keepPreviousData,
  });
}
