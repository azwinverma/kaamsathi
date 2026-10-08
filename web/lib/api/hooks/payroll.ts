"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fetchAllPages } from "../client";
import { qk } from "../keys";
import { track } from "../../telemetry";
import type {
  Paginated,
  PaymentMethod,
  PayrollRun,
  PayrollRunListItem,
  Payslip,
  PayslipUpdate,
} from "../types";

type List<T> = Paginated<T> | T[];

export function usePayrollRuns() {
  return useQuery({
    queryKey: qk.org.payrollRuns,
    queryFn: () => api.get<List<PayrollRunListItem>>("/org/payroll-runs", { page_size: 100 }),
  });
}

export function usePayrollRun(id: string | undefined) {
  return useQuery({
    queryKey: qk.org.payrollRun(id ?? ""),
    queryFn: () => api.get<PayrollRun>(`/org/payroll-runs/${id}`),
    enabled: !!id,
  });
}

export function usePayslips(runId: string | undefined, q?: string) {
  return useQuery({
    queryKey: qk.org.payslips(runId ?? "", q),
    // The wage sheet must show every worker, so read all pages.
    queryFn: () => fetchAllPages<Payslip>(`/org/payroll-runs/${runId}/payslips`, { q }, 20),
    enabled: !!runId,
    // Keep the sheet on screen while a new search loads.
    placeholderData: keepPreviousData,
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bs_year: number; bs_month: number; include_festival_allowance: boolean }) =>
      api.post<PayrollRun>("/org/payroll-runs", body),
    onSuccess: (run) => {
      track("payroll_run_created", { bs_year: run.bs_year, bs_month: run.bs_month });
      qc.invalidateQueries({ queryKey: qk.org.payrollRuns });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}

function useRunAction<TBody = void>(action: "recalculate" | "approve" | "mark-paid") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: TBody }) =>
      api.post<PayrollRun>(`/org/payroll-runs/${id}/${action}`, body ?? {}),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: qk.org.payrollRun(vars.id) });
      qc.invalidateQueries({ queryKey: qk.org.payrollRuns });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
      qc.invalidateQueries({ queryKey: qk.org.advancesAll });
      // Approval locks the month's hajiri.
      if (action === "approve") qc.invalidateQueries({ queryKey: qk.org.attendanceAll });
    },
  });
}
export const useRecalculatePayroll = () => useRunAction("recalculate");
export const useApprovePayroll = () => useRunAction("approve");
export const useMarkPayrollPaid = () =>
  useRunAction<{ paid_on: string; method?: PaymentMethod }>("mark-paid");

export function useUpdatePayslip(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: PayslipUpdate & { id: string }) =>
      api.patch<Payslip>(`/org/payslips/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", "payroll-runs", runId] });
    },
  });
}
