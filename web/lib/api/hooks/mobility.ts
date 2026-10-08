"use client";
/**
 * Hooks for the mobility & intelligence area (docs/CONTRACT-EXTENSIONS.md §5): ops document queue,
 * agency compliance, district heatmap and platform KPIs. Query keys live in this file.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  AgencyComplianceInput,
  Heatmap,
  HeatmapMetric,
  KpiPeriod,
  Kpis,
  OpsAgency,
  OpsMobilityDocument,
  VerifyMobilityDocumentInput,
} from "../types-mobility";

export const mobilityKeys = {
  docsAll: ["ops", "mobility", "documents"] as const,
  docs: (q?: QueryParams) => ["ops", "mobility", "documents", q ?? {}] as const,
  agenciesAll: ["ops", "mobility", "agencies"] as const,
  agencies: (q?: QueryParams) => ["ops", "mobility", "agencies", q ?? {}] as const,
  heatmap: (metric: HeatmapMetric, trade?: string) =>
    ["ops", "insights", "heatmap", metric, trade ?? ""] as const,
  kpis: (days: KpiPeriod) => ["ops", "kpis", days] as const,
};

export function useOpsMobilityDocuments(params?: QueryParams) {
  return useQuery({
    queryKey: mobilityKeys.docs(params),
    queryFn: () => api.get<Paginated<OpsMobilityDocument>>("/ops/mobility/documents", params),
    placeholderData: keepPreviousData,
  });
}

export function useVerifyMobilityDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: VerifyMobilityDocumentInput & { id: string }) =>
      api.post<OpsMobilityDocument>(`/ops/mobility/documents/${id}/verify`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: mobilityKeys.docsAll }),
  });
}

export function useOpsAgencies(params?: QueryParams) {
  return useQuery({
    queryKey: mobilityKeys.agencies(params),
    queryFn: () => api.get<Paginated<OpsAgency>>("/ops/mobility/agencies", params),
    placeholderData: keepPreviousData,
  });
}

export function useSetAgencyCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AgencyComplianceInput & { id: string }) =>
      api.post<OpsAgency>(`/ops/mobility/agencies/${id}/compliance`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mobilityKeys.agenciesAll });
      qc.invalidateQueries({ queryKey: ["ops", "partners"] });
    },
  });
}

export function useHeatmap(metric: HeatmapMetric, trade?: string) {
  return useQuery({
    queryKey: mobilityKeys.heatmap(metric, trade),
    queryFn: () => api.get<Heatmap>("/ops/insights/heatmap", { metric, trade: trade || undefined }),
    placeholderData: keepPreviousData,
  });
}

export function useKpis(days: KpiPeriod) {
  return useQuery({
    queryKey: mobilityKeys.kpis(days),
    queryFn: () => api.get<Kpis>("/ops/kpis", { days }),
    placeholderData: keepPreviousData,
  });
}
