"use client";
/** Hooks for the experience area (docs/CONTRACT-EXTENSIONS.md §3). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import { qk } from "../keys";
import { track } from "../../telemetry";
import type {
  JobAlert,
  JobAlertInput,
  MyApplication,
  MyJobOffer,
  OfferInput,
  OrgJobOffer,
  OpsWorkHistoryEntry,
  RecommendedJob,
  VerifyWorkHistoryInput,
  WorkHistoryConfirmation,
  WorkHistoryEntry,
  WorkerResponse,
} from "../types-experience";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const experienceKeys = {
  opsAll: ["ops", "work-history"] as const,
  ops: (q?: QueryParams) => ["ops", "work-history", "list", q ?? {}] as const,
  orgAll: ["org", "work-history"] as const,
  org: (q?: QueryParams) => ["org", "work-history", "confirmations", q ?? {}] as const,
  me: ["me", "work-history"] as const,
  meRecommended: (q?: QueryParams) => ["me", "jobs", "recommended", q ?? {}] as const,
  meApplicationsAll: ["me", "applications"] as const,
  meApplications: (q?: QueryParams) => ["me", "applications", q ?? {}] as const,
  orgOffersAll: ["org", "offers"] as const,
  orgOffers: (q?: QueryParams) => ["org", "offers", q ?? {}] as const,
  meOffers: ["me", "job-offers"] as const,
  meAlerts: ["me", "job-alerts"] as const,
};

// ---------------------------------------------------------------- ops reference checks
export function useOpsWorkHistory(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: experienceKeys.ops(params),
    queryFn: () => api.get<Paginated<OpsWorkHistoryEntry>>("/ops/work-history", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useVerifyWorkHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: VerifyWorkHistoryInput & { id: string }) =>
      api.post<OpsWorkHistoryEntry>(`/ops/work-history/${id}/verify`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.opsAll }),
  });
}

// ---------------------------------------------------------------- employer confirmations
export function useWorkHistoryConfirmations(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: experienceKeys.org(params),
    queryFn: () =>
      api.get<Paginated<WorkHistoryConfirmation>>("/org/work-history-confirmations", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDecideWorkHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "confirm" | "reject";
      note?: string;
    }) =>
      api.post<WorkHistoryConfirmation>(`/org/work-history/${id}/${decision}`, {
        note: note ?? "",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.orgAll }),
  });
}

// ---------------------------------------------------------------- worker self-service
export function useMyWorkHistory() {
  return useQuery({
    queryKey: experienceKeys.me,
    queryFn: () => api.get<Paginated<WorkHistoryEntry>>("/me/work-history", { page_size: 100 }),
  });
}

export function useRecommendedJobs(params?: QueryParams) {
  return useQuery({
    queryKey: experienceKeys.meRecommended(params),
    queryFn: () => api.get<Paginated<RecommendedJob>>("/me/jobs/recommended", params),
    placeholderData: keepPreviousData,
  });
}

export function useExpressInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.post<MyApplication>(`/me/jobs/${jobId}/interest`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "jobs"] });
      qc.invalidateQueries({ queryKey: experienceKeys.meApplicationsAll });
    },
  });
}

export function useMyApplications(params?: QueryParams) {
  return useQuery({
    queryKey: experienceKeys.meApplications(params),
    queryFn: () => api.get<Paginated<MyApplication>>("/me/applications", params),
    placeholderData: keepPreviousData,
  });
}

export function useRespondToApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response, note }: { id: string; response: WorkerResponse; note?: string }) =>
      api.post<MyApplication>(`/me/applications/${id}/respond`, { response, note: note ?? "" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.meApplicationsAll }),
  });
}

// ---------------------------------------------------------------- job offers (EMP-07)
export function useSendOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...body }: OfferInput & { applicationId: string }) =>
      api.post<OrgJobOffer>(`/org/applications/${applicationId}/offer`, body),
    onSuccess: (_offer, vars) => {
      track("feature_used", {
        feature: "offer_sent",
        application_id: vars.applicationId,
        wage_type: vars.wage_type,
      });
      qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
      qc.invalidateQueries({ queryKey: experienceKeys.orgOffersAll });
    },
  });
}

export function useWithdrawOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<OrgJobOffer>(`/org/offers/${id}/withdraw`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
      qc.invalidateQueries({ queryKey: experienceKeys.orgOffersAll });
    },
  });
}

export function useOrgOffers(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: experienceKeys.orgOffers(params),
    queryFn: () => api.get<Paginated<OrgJobOffer>>("/org/offers", params),
    enabled,
  });
}

export function useMyJobOffers() {
  return useQuery({
    queryKey: experienceKeys.meOffers,
    queryFn: () => api.get<Paginated<MyJobOffer>>("/me/job-offers", { page_size: 50 }),
  });
}

export function useRespondToOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) =>
      api.post<MyJobOffer>(`/me/job-offers/${id}/${accept ? "accept" : "decline"}`, {
        reason: reason ?? "",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.meOffers }),
  });
}

// ---------------------------------------------------------------- job alerts (SEARCH-02)
export function useMyJobAlerts() {
  return useQuery({
    queryKey: experienceKeys.meAlerts,
    queryFn: () => api.get<Paginated<JobAlert>>("/me/job-alerts", { page_size: 50 }),
  });
}

export function useSaveJobAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: JobAlertInput & { id?: string }) =>
      id
        ? api.patch<JobAlert>(`/me/job-alerts/${id}`, body)
        : api.post<JobAlert>("/me/job-alerts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.meAlerts }),
  });
}

export function useDeleteJobAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/job-alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: experienceKeys.meAlerts }),
  });
}
