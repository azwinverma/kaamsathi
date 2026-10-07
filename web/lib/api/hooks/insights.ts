"use client";
/** Hooks for the insights area (docs/CONTRACT-ECOSYSTEM.md §10). Query keys live in this file. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { LabourMarket, OrgAnalytics } from "../types-insights";

export const insightsKeys = {
  /** Org-scoped (reset on org switch). */
  orgAnalytics: (months: number) => ["org", "analytics", months] as const,
  labourMarket: (q?: QueryParams) => ["ops", "insights", "labour-market", q ?? {}] as const,
};

export function useOrgAnalytics(months = 6) {
  return useQuery({
    queryKey: insightsKeys.orgAnalytics(months),
    queryFn: () => api.get<OrgAnalytics>("/org/analytics", { months }),
    placeholderData: keepPreviousData,
  });
}

export function useLabourMarket(params?: { district?: string; trade?: string }) {
  return useQuery({
    queryKey: insightsKeys.labourMarket(params),
    queryFn: () => api.get<LabourMarket>("/ops/insights/labour-market", params),
    placeholderData: keepPreviousData,
  });
}
