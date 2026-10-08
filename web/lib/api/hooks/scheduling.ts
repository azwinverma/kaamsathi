"use client";
/** Hooks for the scheduling area (docs/CONTRACT-ECOSYSTEM.md §7). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type {
  RosterCopyResult,
  RosterEntryInput,
  RosterSaveResult,
  RosterWeek,
} from "../types-scheduling";

export const rosterKeys = {
  all: ["org", "roster"] as const,
  week: (weekStart: string, site?: string) => ["org", "roster", weekStart, site ?? ""] as const,
};

export function useRoster(weekStart: string, site?: string) {
  return useQuery({
    queryKey: rosterKeys.week(weekStart, site),
    queryFn: () => api.get<RosterWeek>("/org/roster", { week_start: weekStart, site }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: RosterEntryInput[]) =>
      api.put<RosterSaveResult>("/org/roster", { entries }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rosterKeys.all });
      qc.invalidateQueries({ queryKey: ["org", "attendance"] });
    },
  });
}

export function useCopyRosterWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { from_week_start: string; to_week_start: string; site?: string | null }) =>
      api.post<RosterCopyResult>("/org/roster/copy-week", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: rosterKeys.all }),
  });
}
