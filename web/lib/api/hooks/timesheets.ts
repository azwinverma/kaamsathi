"use client";
/** Hooks for the timesheets area (docs/CONTRACT-EXTENSIONS.md §4). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetchAllPages } from "../client";
import type {
  Timesheet,
  TimesheetBulkResult,
  TimesheetGenerateResult,
  TimesheetPolicy,
  TimesheetStatus,
} from "../types-timesheets";

export const timesheetKeys = {
  all: ["org", "timesheets"] as const,
  week: (weekStart: string, site?: string, status?: string) =>
    ["org", "timesheets", "week", weekStart, site ?? "", status ?? ""] as const,
  policy: ["org", "timesheet-policy"] as const,
};

export interface TimesheetFilters {
  week_start: string;
  site?: string;
  status?: TimesheetStatus | "";
}

/** Every timesheet of a week (all pages — the table shows the whole crew). */
export function useTimesheets({ week_start, site, status }: TimesheetFilters) {
  return useQuery({
    queryKey: timesheetKeys.week(week_start, site, status || undefined),
    queryFn: () =>
      fetchAllPages<Timesheet>(
        "/org/timesheets",
        { week_start, site, status: status || undefined, page_size: 100 },
        20,
      ),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: timesheetKeys.all });
}

export function useGenerateTimesheets() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { week_start: string; site?: string | null }) =>
      api.post<TimesheetGenerateResult>("/org/timesheets/generate", body),
    onSuccess: invalidate,
  });
}

export function useSubmitTimesheet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<Timesheet>(`/org/timesheets/${id}/submit`, {}),
    onSuccess: invalidate,
  });
}

export function useApproveTimesheet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      overtime_minutes_approved,
    }: {
      id: string;
      overtime_minutes_approved?: number | null;
    }) => api.post<Timesheet>(`/org/timesheets/${id}/approve`, { overtime_minutes_approved }),
    onSuccess: invalidate,
  });
}

export function useRejectTimesheet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post<Timesheet>(`/org/timesheets/${id}/reject`, { note }),
    onSuccess: invalidate,
  });
}

export function useBulkApproveTimesheets() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<TimesheetBulkResult>("/org/timesheets/bulk-approve", { ids }),
    onSuccess: invalidate,
  });
}

export function useTimesheetPolicy() {
  return useQuery({
    queryKey: timesheetKeys.policy,
    queryFn: () => api.get<TimesheetPolicy>("/org/timesheet-policy"),
  });
}

export function useUpdateTimesheetPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<TimesheetPolicy>) =>
      api.patch<TimesheetPolicy>("/org/timesheet-policy", body),
    onSuccess: (data) => {
      qc.setQueryData(timesheetKeys.policy, data);
      qc.invalidateQueries({ queryKey: timesheetKeys.all });
    },
  });
}
