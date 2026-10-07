"use client";
/** Hooks for the payouts area (docs/CONTRACT-ECOSYSTEM.md §6). Query keys live in this file. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { Paginated } from "../types";
import type {
  PayoutBatch,
  PayoutItemMark,
  PayoutProvider,
  RunPayoutOptions,
} from "../types-payouts";

export const payoutKeys = {
  all: ["org", "payouts"] as const,
  byRun: (runId: string) => ["org", "payouts", "run", runId] as const,
  options: (runId: string) => ["org", "payouts", "options", runId] as const,
  batch: (id: string) => ["org", "payouts", "detail", id] as const,
};

export function useRunPayoutOptions(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: payoutKeys.options(runId ?? ""),
    queryFn: () => api.get<RunPayoutOptions>(`/org/payroll-runs/${runId}/payouts`),
    enabled: !!runId && enabled,
  });
}

export function useRunPayouts(runId: string | undefined) {
  return useQuery({
    queryKey: payoutKeys.byRun(runId ?? ""),
    queryFn: () => api.get<Paginated<PayoutBatch>>("/org/payouts", { run: runId, page_size: 100 }),
    enabled: !!runId,
  });
}

export function usePayoutBatch(id: string | undefined) {
  return useQuery({
    queryKey: payoutKeys.batch(id ?? ""),
    queryFn: () => api.get<PayoutBatch>(`/org/payouts/${id}`),
    enabled: !!id,
  });
}

/** After any payout change: batches, options, and the payroll run (it may have been auto-marked paid). */
function useInvalidatePayouts() {
  const qc = useQueryClient();
  return (batch?: PayoutBatch) => {
    if (batch) qc.setQueryData(payoutKeys.batch(batch.id), batch);
    qc.invalidateQueries({ queryKey: payoutKeys.all });
    qc.invalidateQueries({ queryKey: ["org", "payroll-runs"] });
    qc.invalidateQueries({ queryKey: ["org", "dashboard"] });
  };
}

export function useCreatePayoutBatch(runId: string) {
  const done = useInvalidatePayouts();
  return useMutation({
    mutationFn: (provider: PayoutProvider) =>
      api.post<PayoutBatch>(`/org/payroll-runs/${runId}/payouts`, { provider }),
    onSuccess: (b) => done(b),
  });
}

function useBatchAction(action: "submit" | "cancel") {
  const done = useInvalidatePayouts();
  return useMutation({
    mutationFn: (id: string) => api.post<PayoutBatch>(`/org/payouts/${id}/${action}`),
    onSuccess: (b) => done(b),
  });
}
export const useSubmitPayoutBatch = () => useBatchAction("submit");
export const useCancelPayoutBatch = () => useBatchAction("cancel");

export function useMarkPayoutItem() {
  const done = useInvalidatePayouts();
  return useMutation({
    mutationFn: ({
      batchId,
      itemId,
      ...body
    }: PayoutItemMark & { batchId: string; itemId: string }) =>
      api.post<PayoutBatch>(`/org/payouts/${batchId}/items/${itemId}/mark`, body),
    onSuccess: (b) => done(b),
  });
}

export function useReconcilePayoutBatch() {
  const done = useInvalidatePayouts();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<PayoutBatch>(`/org/payouts/${id}/reconcile`, form);
    },
    onSuccess: (b) => done(b),
  });
}
