"use client";
/** Hooks for the finance area (docs/CONTRACT-ECOSYSTEM.md §9). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type { FinanceOffer, FinanceOfferInput, FinanceReferral, FinanceSummary } from "../types-finance";

export const financeKeys = {
  all: ["ops", "finance"] as const,
  summary: ["ops", "finance", "summary"] as const,
  offers: (q?: QueryParams) => ["ops", "finance", "offers", q ?? {}] as const,
  offersAll: ["ops", "finance", "offers"] as const,
  referrals: (q?: QueryParams) => ["ops", "finance", "referrals", q ?? {}] as const,
};

export function useFinanceSummary() {
  return useQuery({
    queryKey: financeKeys.summary,
    queryFn: () => api.get<FinanceSummary>("/ops/finance/summary"),
  });
}

export function useFinanceOffers(params?: QueryParams) {
  return useQuery({
    queryKey: financeKeys.offers(params),
    queryFn: () => api.get<Paginated<FinanceOffer>>("/ops/finance/offers", params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateFinanceOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FinanceOfferInput) => api.post<FinanceOffer>("/ops/finance/offers", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useUpdateFinanceOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FinanceOfferInput> & { id: string }) =>
      api.patch<FinanceOffer>(`/ops/finance/offers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useFinanceReferrals(params?: QueryParams) {
  return useQuery({
    queryKey: financeKeys.referrals(params),
    queryFn: () => api.get<Paginated<FinanceReferral>>("/ops/finance/referrals", params),
    placeholderData: keepPreviousData,
  });
}
