"use client";
/** Hooks for attendance correction requests (P008). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type { AttendanceCorrection } from "../types-corrections";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const correctionKeys = {
  all: ["org", "attendance-corrections"] as const,
  list: (q?: QueryParams) => ["org", "attendance-corrections", "list", q ?? {}] as const,
};

/** `GET /org/attendance-corrections?status=&employment=` — supervisors only see their sites. */
export function useOrgCorrections(params?: QueryParams) {
  return useQuery({
    queryKey: correctionKeys.list(params),
    queryFn: () => api.get<Paginated<AttendanceCorrection>>("/org/attendance-corrections", params),
    placeholderData: keepPreviousData,
  });
}

/** Pending count for entry points (one-row page; reads `count`). */
export function usePendingCorrectionsCount() {
  const q = useOrgCorrections({ status: "pending", page_size: 1 });
  return q.data?.count ?? 0;
}

/** Approve (note optional; payroll-locked month → 400 invalid_state) or reject (note required). */
export function useDecideCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "approve" | "reject";
      note?: string;
    }) =>
      api.post<AttendanceCorrection>(`/org/attendance-corrections/${id}/${decision}`, {
        ...(note ? { note } : {}),
      }),
    onSuccess: (_c, v) => {
      qc.invalidateQueries({ queryKey: correctionKeys.all });
      if (v.decision === "approve") qc.invalidateQueries({ queryKey: ["org", "attendance"] });
    },
  });
}
