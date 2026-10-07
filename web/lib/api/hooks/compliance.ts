"use client";
/** Hooks for the compliance area (docs/CONTRACT-ECOSYSTEM.md §5). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  ComplianceStatus,
  Contractor,
  ContractorInput,
  ContractorSummary,
  ContractLanguage,
  EmploymentContractState,
  SSFFiling,
  SSFFilingUpdate,
} from "../types-compliance";

type List<T> = Paginated<T> | T[];

export const complianceKeys = {
  status: ["org", "compliance", "status"] as const,
  filings: ["org", "compliance", "ssf-filings"] as const,
  contract: (employmentId: string) => ["org", "compliance", "contract", employmentId] as const,
  contractorsAll: ["org", "compliance", "contractors"] as const,
  contractors: (q?: QueryParams) => ["org", "compliance", "contractors", "list", q ?? {}] as const,
  contractor: (id: string) => ["org", "compliance", "contractors", "detail", id] as const,
  contractorSummary: (id: string, y: number, m: number) =>
    ["org", "compliance", "contractors", "summary", id, y, m] as const,
};

// ------------------------------------------------------------- status
export function useComplianceStatus() {
  return useQuery({
    queryKey: complianceKeys.status,
    queryFn: () => api.get<ComplianceStatus>("/org/compliance"),
  });
}

// ------------------------------------------------------------- SSF filings
export function useSSFFilings() {
  return useQuery({
    queryKey: complianceKeys.filings,
    queryFn: () => api.get<List<SSFFiling>>("/org/ssf-filings", { page_size: 100 }),
  });
}

function invalidateCompliance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: complianceKeys.filings });
  qc.invalidateQueries({ queryKey: complianceKeys.status });
}

export function usePrepareSSFFiling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<SSFFiling>(`/org/payroll-runs/${runId}/ssf-filing`),
    onSuccess: () => invalidateCompliance(qc),
  });
}

export function useUpdateSSFFiling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SSFFilingUpdate & { id: string }) =>
      api.patch<SSFFiling>(`/org/ssf-filings/${id}`, body),
    onSuccess: () => invalidateCompliance(qc),
  });
}

// ------------------------------------------------------------- contracts
export function useEmploymentContract(employmentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: complianceKeys.contract(employmentId ?? ""),
    queryFn: () => api.get<EmploymentContractState>(`/org/employments/${employmentId}/contract`),
    enabled: !!employmentId && enabled,
  });
}

export function useGenerateContract(employmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { language?: ContractLanguage; force?: boolean }) =>
      api.post<EmploymentContractState>(`/org/employments/${employmentId}/contract`, body),
    onSuccess: (data) => {
      qc.setQueryData(complianceKeys.contract(employmentId), data);
      qc.invalidateQueries({ queryKey: complianceKeys.status });
    },
  });
}

export function useRecordContractAcceptance(employmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: "paper" | "sms") =>
      api.post<EmploymentContractState>(`/org/employments/${employmentId}/contract/accept`, {
        channel,
      }),
    onSuccess: (data) => {
      qc.setQueryData(complianceKeys.contract(employmentId), data);
      qc.invalidateQueries({ queryKey: complianceKeys.status });
    },
  });
}

// ------------------------------------------------------------- contractors
export function useContractors(params?: QueryParams) {
  return useQuery({
    queryKey: complianceKeys.contractors(params),
    queryFn: () =>
      api.get<Paginated<Contractor>>("/org/contractors", { page_size: 100, ...params }),
    placeholderData: keepPreviousData,
  });
}

export function useContractor(id: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.contractor(id ?? ""),
    queryFn: () => api.get<Contractor>(`/org/contractors/${id}`),
    enabled: !!id,
  });
}

export function useContractorSummary(id: string | undefined, bsYear: number, bsMonth: number) {
  return useQuery({
    queryKey: complianceKeys.contractorSummary(id ?? "", bsYear, bsMonth),
    queryFn: () =>
      api.get<ContractorSummary>(`/org/contractors/${id}/summary`, {
        bs_year: bsYear,
        bs_month: bsMonth,
      }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

function useContractorMutation<TVars>(fn: (vars: TVars) => Promise<Contractor>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (c) => {
      if (c?.id) qc.setQueryData(complianceKeys.contractor(c.id), c);
      qc.invalidateQueries({ queryKey: complianceKeys.contractorsAll });
      qc.invalidateQueries({ queryKey: ["org", "employments"] });
    },
  });
}

export const useCreateContractor = () =>
  useContractorMutation((body: ContractorInput) => api.post<Contractor>("/org/contractors", body));

export const useUpdateContractor = () =>
  useContractorMutation(({ id, ...body }: Partial<ContractorInput> & { id: string }) =>
    api.patch<Contractor>(`/org/contractors/${id}`, body),
  );

export const useAssignToContractor = () =>
  useContractorMutation(({ id, employment_ids }: { id: string; employment_ids: string[] }) =>
    api.post<Contractor>(`/org/contractors/${id}/assign`, { employment_ids }),
  );

export const useUnassignFromContractor = () =>
  useContractorMutation(({ id, employment_ids }: { id: string; employment_ids: string[] }) =>
    api.post<Contractor>(`/org/contractors/${id}/unassign`, { employment_ids }),
  );

export function useDeleteContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/contractors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.contractorsAll }),
  });
}
