"use client";
/** Ops product analytics (first-party telemetry): funnels and weekly retention, k-anonymous. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../client";

export type FunnelName = "worker_onboarding" | "employer_activation" | "hiring";
export const FUNNEL_NAMES: FunnelName[] = ["worker_onboarding", "employer_activation", "hiring"];

export interface FunnelStep {
  key: string;
  event: string;
  /** null when suppressed (1..k-1 subjects) */
  count: number | null;
  suppressed: boolean;
  conversion_from_previous: number | null;
  conversion_from_start: number | null;
}
export interface Funnel {
  name: FunnelName;
  days: number;
  k_anonymity: number;
  steps: FunnelStep[];
}
export interface RetentionRow {
  cohort_start: string;
  size: number | null;
  suppressed: boolean;
  weeks: { week: number; retained: number | null; rate: number | null }[];
}
export interface Retention {
  cohort: "week";
  weeks: number;
  k_anonymity: number;
  rows: RetentionRow[];
}

export const analyticsKeys = {
  funnel: (name: string, days: number) => ["ops", "analytics", "funnel", name, days] as const,
  retention: (weeks: number) => ["ops", "analytics", "retention", weeks] as const,
};

export function useFunnel(name: FunnelName, days: number) {
  return useQuery({
    queryKey: analyticsKeys.funnel(name, days),
    queryFn: () => api.get<Funnel>("/ops/analytics/funnel", { name, days }),
    placeholderData: keepPreviousData,
  });
}

export function useRetention(weeks: number) {
  return useQuery({
    queryKey: analyticsKeys.retention(weeks),
    queryFn: () => api.get<Retention>("/ops/analytics/retention", { cohort: "week", weeks }),
    placeholderData: keepPreviousData,
  });
}
