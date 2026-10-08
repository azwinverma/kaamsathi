"use client";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import { qk } from "../keys";
import type {
  Advance,
  AdvanceInput,
  AttendanceDay,
  AttendanceRecordInput,
  AttendanceRegister,
  BulkAttendanceResult,
  Employment,
  EmploymentCreate,
  EmploymentUpdate,
  EndReason,
  ImportResult,
  LeaveInput,
  LeaveRequest,
  Paginated,
  PayrollRunListItem,
} from "../types";
import type { EmploymentHistoryEvent } from "../types-history";

type List<T> = Paginated<T> | T[];

// ------------------------------------------------------------- employments
export function useEmployments(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: qk.org.employments(params),
    queryFn: () => api.get<Paginated<Employment>>("/org/employments", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEmployment(id: string | undefined) {
  return useQuery({
    queryKey: qk.org.employment(id ?? ""),
    queryFn: () => api.get<Employment>(`/org/employments/${id}`),
    enabled: !!id,
  });
}

/** GET /org/employments/{id}/history — newest first, 50 per page; `fetchNextPage` loads older events. */
export function useEmploymentHistory(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.org.employmentHistory(id ?? ""),
    queryFn: ({ pageParam }) =>
      api.get<Paginated<EmploymentHistoryEvent>>(`/org/employments/${id}/history`, {
        page: pageParam,
        page_size: 50,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, _all, page) => (last.next ? page + 1 : undefined),
    enabled: !!id,
  });
}

export function useCreateEmployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EmploymentCreate) => api.post<Employment>("/org/employments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.employmentsAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

export function useUpdateEmployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: EmploymentUpdate & { id: string }) =>
      api.patch<Employment>(`/org/employments/${id}`, body),
    onSuccess: (emp) => {
      qc.setQueryData(qk.org.employment(emp.id), emp);
      qc.invalidateQueries({ queryKey: qk.org.employmentsAll });
    },
  });
}

export function useEndEmployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; end_date: string; end_reason: EndReason }) =>
      api.post<Employment>(`/org/employments/${id}/end`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.employmentsAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

export function useRateEmployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; score_a: number; score_b: number; comment?: string }) =>
      api.post(`/org/employments/${id}/rate`, body),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: qk.org.employment(vars.id) });
      qc.invalidateQueries({ queryKey: qk.org.employmentHistory(vars.id) });
    },
  });
}

export function useImportEmployments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<ImportResult>("/org/employments/import", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.employmentsAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

// ------------------------------------------------------------- attendance
export function useAttendanceDay(date: string, site?: string) {
  return useQuery({
    queryKey: qk.org.attendanceDay(date, site),
    queryFn: () => api.get<AttendanceDay>("/org/attendance/day", { date, site }),
    placeholderData: keepPreviousData,
  });
}

export function useAttendanceRegister(bsYear: number, bsMonth: number, site?: string) {
  return useQuery({
    queryKey: qk.org.attendanceRegister(bsYear, bsMonth, site),
    queryFn: () =>
      api.get<AttendanceRegister>("/org/attendance/register", {
        bs_year: bsYear,
        bs_month: bsMonth,
        site,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useBulkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: AttendanceRecordInput[]) =>
      api.post<BulkAttendanceResult>("/org/attendance/bulk", { records }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.attendanceAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

// ------------------------------------------------------------- leave
export function useLeaves(params?: QueryParams) {
  return useQuery({
    queryKey: qk.org.leaves(params),
    queryFn: () => api.get<List<LeaveRequest>>("/org/leaves", params),
    placeholderData: keepPreviousData,
  });
}
export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LeaveInput) => api.post<LeaveRequest>("/org/leaves", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.leavesAll }),
  });
}
export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      api.post<LeaveRequest>(`/org/leaves/${id}/${decision}`, decision === "reject" ? { note } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.leavesAll });
      qc.invalidateQueries({ queryKey: qk.org.attendanceAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

// ------------------------------------------------------------- advances (peski)
export function useAdvances(params?: QueryParams) {
  return useQuery({
    queryKey: qk.org.advances(params),
    queryFn: () => api.get<List<Advance>>("/org/advances", params),
    placeholderData: keepPreviousData,
  });
}
export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdvanceInput) => api.post<Advance>("/org/advances", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.advancesAll });
      qc.invalidateQueries({ queryKey: qk.org.employmentHistoryAll });
    },
  });
}
export function useUpdateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AdvanceInput> & { id: string }) =>
      api.patch<Advance>(`/org/advances/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.advancesAll });
      qc.invalidateQueries({ queryKey: qk.org.employmentHistoryAll });
    },
  });
}

// ------------------------------------------------------------- payroll lock (read-only)
/**
 * Payroll runs, used only to tell whether a BS month's attendance is locked
 * (approved/paid run). Shares the payroll list cache; disabled for supervisors (no access).
 */
export function usePayrollRunsForLock(enabled: boolean) {
  return useQuery({
    queryKey: qk.org.payrollRuns,
    queryFn: () => api.get<List<PayrollRunListItem>>("/org/payroll-runs", { page_size: 100 }),
    enabled,
    staleTime: 60_000,
  });
}
