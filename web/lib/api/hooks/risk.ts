"use client";
/**
 * Hooks for trust operations (docs/CONTRACT-EXTENSIONS.md §2): risk flags, employer verification
 * (KYB) and the trade taxonomy. Query keys live in this file.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  EmployerVerifyInput,
  KybSubmitInput,
  ManualFlagInput,
  OpsEmployer,
  OrgVerification,
  ResolveFlagInput,
  RiskFlag,
  RiskSummary,
  TaxonomyTrade,
  TradeInput,
} from "../types-risk";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const riskKeys = {
  flagsAll: ["ops", "risk", "flags"] as const,
  flags: (q?: QueryParams) => ["ops", "risk", "flags", q ?? {}] as const,
  summary: ["ops", "risk", "summary"] as const,
  employersAll: ["ops", "employers"] as const,
  employers: (q?: QueryParams) => ["ops", "employers", "list", q ?? {}] as const,
  employer: (id: string) => ["ops", "employers", "detail", id] as const,
  orgVerification: ["org", "verification"] as const,
  tradesAll: ["ops", "taxonomy", "trades"] as const,
  trades: (q?: QueryParams) => ["ops", "taxonomy", "trades", q ?? {}] as const,
};

// ---------------------------------------------------------------- risk (ops)
export function useRiskFlags(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: riskKeys.flags(params),
    queryFn: () => api.get<Paginated<RiskFlag>>("/ops/risk/flags", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRiskSummary() {
  return useQuery({
    queryKey: riskKeys.summary,
    queryFn: () => api.get<RiskSummary>("/ops/risk/summary"),
  });
}

function useInvalidateRisk() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: riskKeys.flagsAll });
    qc.invalidateQueries({ queryKey: riskKeys.summary });
    qc.invalidateQueries({ queryKey: ["ops", "workers"] });
  };
}

export function useResolveRiskFlag() {
  const invalidate = useInvalidateRisk();
  return useMutation({
    mutationFn: ({ id, ...body }: ResolveFlagInput) =>
      api.post<RiskFlag>(`/ops/risk/flags/${id}/resolve`, body),
    onSuccess: invalidate,
  });
}

export function useCreateRiskFlag() {
  const invalidate = useInvalidateRisk();
  return useMutation({
    mutationFn: (body: ManualFlagInput) => api.post<RiskFlag>("/ops/risk/flags", body),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- KYB (employer)
export function useOrgVerification(enabled = true) {
  return useQuery({
    queryKey: riskKeys.orgVerification,
    queryFn: () => api.get<OrgVerification>("/org/verification"),
    enabled,
  });
}

export function useSubmitOrgVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KybSubmitInput) => {
      const form = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v === undefined || v === null || v === "") continue;
        form.append(k, v instanceof File ? v : String(v));
      }
      return api.upload<OrgVerification>("/org/verification", form);
    },
    onSuccess: (data) => {
      qc.setQueryData(riskKeys.orgVerification, data);
      qc.invalidateQueries({ queryKey: ["org"] });
    },
  });
}

// ---------------------------------------------------------------- KYB (ops)
export function useOpsEmployers(params?: QueryParams) {
  return useQuery({
    queryKey: riskKeys.employers(params),
    queryFn: () => api.get<Paginated<OpsEmployer>>("/ops/employers", params),
    placeholderData: keepPreviousData,
  });
}

/** Detail re-issues fresh signed document URLs (they expire after ~10 minutes). */
export function useOpsEmployer(id: string | null) {
  return useQuery({
    queryKey: riskKeys.employer(id ?? ""),
    queryFn: () => api.get<OpsEmployer>(`/ops/employers/${id}`),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useVerifyEmployer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: EmployerVerifyInput) =>
      api.post<OpsEmployer>(`/ops/employers/${id}/verify`, body),
    onSuccess: (data) => {
      qc.setQueryData(riskKeys.employer(data.id), data);
      qc.invalidateQueries({ queryKey: riskKeys.employersAll });
      qc.invalidateQueries({ queryKey: ["ops", "organizations"] });
    },
  });
}

// ---------------------------------------------------------------- taxonomy (ops)
export function useTaxonomyTrades(params?: QueryParams) {
  return useQuery({
    queryKey: riskKeys.trades(params),
    queryFn: () =>
      api.get<Paginated<TaxonomyTrade>>("/ops/taxonomy/trades", { page_size: 100, ...params }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTrades() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: riskKeys.tradesAll });
    qc.invalidateQueries({ queryKey: ["ref"] });
  };
}

export function useCreateTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation({
    mutationFn: (body: TradeInput) => api.post<TaxonomyTrade>("/ops/taxonomy/trades", body),
    onSuccess: invalidate,
  });
}

export function useUpdateTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation({
    mutationFn: ({ code, ...body }: Partial<Omit<TradeInput, "code">> & { code: string }) =>
      api.patch<TaxonomyTrade>(`/ops/taxonomy/trades/${code}`, body),
    onSuccess: invalidate,
  });
}
