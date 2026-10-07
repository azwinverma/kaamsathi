"use client";
/** Hooks for the credentials area (docs/CONTRACT-ECOSYSTEM.md §3). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, proxyHref, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  AssessmentInput,
  Credential,
  ExpiringCredential,
  MyPassport,
  OpsCredential,
  OpsWorkerCredentials,
  PassportSettings,
  PassportShare,
  PassportShareInput,
  SkillAssessment,
  VerifyCredentialInput,
} from "../types-credentials";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const credentialKeys = {
  opsAll: ["ops", "credentials"] as const,
  ops: (q?: QueryParams) => ["ops", "credentials", "list", q ?? {}] as const,
  opsOne: (id: string) => ["ops", "credentials", "detail", id] as const,
  assessmentsAll: ["ops", "assessments"] as const,
  assessments: (q?: QueryParams) => ["ops", "assessments", q ?? {}] as const,
  opsWorker: (workerId: string) => ["ops", "workers", "detail", workerId, "credentials"] as const,
  orgExpiring: (days: number, q?: QueryParams) =>
    ["org", "credentials", "expiring", days, q ?? {}] as const,
  me: ["me", "credentials"] as const,
  mePassport: ["me", "passport"] as const,
  meShares: ["me", "passport", "shares"] as const,
};

// ---------------------------------------------------------------- ops
export function useOpsCredentials(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: credentialKeys.ops(params),
    queryFn: () => api.get<Paginated<OpsCredential>>("/ops/credentials", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOpsCredential(id: string | null | undefined) {
  return useQuery({
    queryKey: credentialKeys.opsOne(id ?? ""),
    queryFn: () => api.get<OpsCredential>(`/ops/credentials/${id}`),
    enabled: !!id,
  });
}

export function useVerifyCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: VerifyCredentialInput & { id: string }) =>
      api.post<OpsCredential>(`/ops/credentials/${id}/verify`, body),
    onSuccess: (c) => {
      qc.setQueryData(credentialKeys.opsOne(c.id), c);
      qc.invalidateQueries({ queryKey: credentialKeys.opsAll });
      qc.invalidateQueries({ queryKey: credentialKeys.opsWorker(c.worker.id) });
    },
  });
}

export function useOpsAssessments(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: credentialKeys.assessments(params),
    queryFn: () => api.get<Paginated<SkillAssessment>>("/ops/assessments", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssessmentInput) => api.post<SkillAssessment>("/ops/assessments", body),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: credentialKeys.assessmentsAll });
      qc.invalidateQueries({ queryKey: credentialKeys.opsWorker(a.worker.id) });
    },
  });
}

/** Credentials + assessments + passport state for the ops worker page. */
export function useOpsWorkerCredentials(workerId: string | null | undefined) {
  return useQuery({
    queryKey: credentialKeys.opsWorker(workerId ?? ""),
    queryFn: () => api.get<OpsWorkerCredentials>(`/ops/workers/${workerId}/credentials`),
    enabled: !!workerId,
  });
}

// ---------------------------------------------------------------- employer
/**
 * Credentials of the org's active workers expiring within `days` (default 30).
 * Used by the compliance dashboard card (owned by the compliance area).
 */
export function useExpiringCredentials(days = 30, params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: credentialKeys.orgExpiring(days, params),
    queryFn: () =>
      api.get<Paginated<ExpiringCredential>>("/org/credentials/expiring", {
        days,
        page_size: 100,
        ...params,
      }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ---------------------------------------------------------------- worker self-service
export function useMyCredentials() {
  return useQuery({
    queryKey: credentialKeys.me,
    queryFn: () => api.get<Paginated<Credential>>("/me/credentials", { page_size: 100 }),
  });
}

export interface CredentialUploadInput {
  kind: Credential["kind"];
  title: string;
  issuer: string;
  certificate_no?: string;
  level?: string;
  issued_on?: string;
  expires_on?: string;
  document?: File | null;
}

export function useUploadCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CredentialUploadInput) => {
      const form = new FormData();
      for (const [k, v] of Object.entries(input)) {
        if (v === undefined || v === null || v === "") continue;
        form.append(k, v instanceof File ? v : String(v));
      }
      return api.upload<Credential>("/me/credentials", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialKeys.me }),
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/credentials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialKeys.me }),
  });
}

export function useMyPassport(enabled = true) {
  return useQuery({
    queryKey: credentialKeys.mePassport,
    queryFn: () => api.get<MyPassport>("/me/passport"),
    enabled,
  });
}

export function useUpdatePassport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<PassportSettings, "is_public" | "show_contact">>) =>
      api.patch<MyPassport>("/me/passport", body),
    onSuccess: (p) => qc.setQueryData(credentialKeys.mePassport, p),
  });
}

export function usePassportShares() {
  return useQuery({
    queryKey: credentialKeys.meShares,
    queryFn: () => api.get<Paginated<PassportShare>>("/me/passport/shares", { page_size: 100 }),
  });
}

export function useCreatePassportShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PassportShareInput) => api.post<PassportShare>("/me/passport/shares", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialKeys.meShares }),
  });
}

export function useRevokePassportShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<PassportShare>(`/me/passport/shares/${id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: credentialKeys.meShares }),
  });
}

/** Direct link to the worker's bilingual passport PDF (through the BFF proxy). */
export function passportPdfHref(): string {
  return proxyHref("/me/passport.pdf");
}
