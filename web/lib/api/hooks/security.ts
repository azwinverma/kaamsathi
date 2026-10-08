"use client";
/** Hooks for the security area (docs/CONTRACT-EXTENSIONS.md §1). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { ApiError, parseApiError } from "../errors";
import { qk } from "../keys";
import type { Me } from "../types";
import type {
  AuditFilters,
  AuditPage,
  AuditVerifyResult,
  FailedTask,
  FailedTaskPage,
  FailedTaskStatus,
  LegalAcceptResponse,
  LegalDocument,
  MfaConfirmResponse,
  MfaDisableResponse,
  MfaSetupResponse,
  MfaVerifyInput,
  SessionDevice,
  StaffCreateInput,
  StaffMember,
  StaffPage,
  StaffUpdateInput,
  SystemHealth,
} from "../types-security";

export const securityKeys = {
  all: ["security"] as const,
  legalCurrent: ["security", "legal", "current"] as const,
  sessions: ["security", "sessions"] as const,
  auditAll: ["security", "audit"] as const,
  audit: (f: AuditFilters) => ["security", "audit", "list", f] as const,
  staffAll: ["security", "staff"] as const,
  staff: (q: { q?: string; page?: number }) => ["security", "staff", "list", q] as const,
  health: ["security", "system", "health"] as const,
  failedTasksAll: ["security", "system", "failed-tasks"] as const,
  failedTasks: (q: { status: FailedTaskStatus; page: number }) =>
    ["security", "system", "failed-tasks", q] as const,
};

// ---------------------------------------------------------------- login (BFF)
async function bffPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network_error", "Network error. Check your connection.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw parseApiError(res.status, data);
  return data as T;
}

/** Second login factor (TOTP or recovery code). Sets session cookies via the BFF. */
export function useVerifyMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MfaVerifyInput) => bffPost<{ user: Me }>("/api/auth/mfa/verify", input),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(qk.me, user);
    },
  });
}

// ---------------------------------------------------------------- MFA enrolment
export function useMfaSetup() {
  return useMutation({ mutationFn: () => api.post<MfaSetupResponse>("/auth/mfa/setup") });
}

export function useMfaConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<MfaConfirmResponse>("/auth/mfa/confirm", { code }),
    // Refresh Me so the ops MFA gate lifts; the caller keeps the codes in local state.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useMfaDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<MfaDisableResponse>("/auth/mfa/disable", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

// ---------------------------------------------------------------- legal acceptance
export function useCurrentLegal(enabled = true) {
  return useQuery({
    queryKey: securityKeys.legalCurrent,
    queryFn: ({ signal }) => api.get<LegalDocument[]>("/legal/current", undefined, signal),
    staleTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useAcceptLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) =>
      api.post<LegalAcceptResponse>("/auth/legal/accept", { document_ids: documentIds }),
    onSuccess: (res) => {
      // Lift the gate immediately, then refetch the authoritative Me.
      qc.setQueryData<Me>(qk.me, (me) =>
        me ? { ...me, pending_legal: res.pending_legal ?? [] } : me,
      );
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

// ---------------------------------------------------------------- sessions
export function useSessions() {
  return useQuery({
    queryKey: securityKeys.sessions,
    queryFn: ({ signal }) => api.get<SessionDevice[]>("/auth/sessions", undefined, signal),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: securityKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ revoked: number }>("/auth/sessions/revoke-others"),
    onSettled: () => qc.invalidateQueries({ queryKey: securityKeys.sessions }),
  });
}

// ---------------------------------------------------------------- audit
export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: securityKeys.audit(filters),
    queryFn: ({ signal }) => api.get<AuditPage>("/ops/audit", { ...filters }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useVerifyAuditChain() {
  return useMutation({ mutationFn: () => api.get<AuditVerifyResult>("/ops/audit/verify") });
}

// ---------------------------------------------------------------- staff
export function useStaff(q: { q?: string; page?: number }) {
  return useQuery({
    queryKey: securityKeys.staff(q),
    queryFn: ({ signal }) => api.get<StaffPage>("/ops/staff", { q: q.q, page: q.page }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffCreateInput) => api.post<StaffMember>("/ops/staff", input),
    onSettled: () => qc.invalidateQueries({ queryKey: securityKeys.staffAll }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: StaffUpdateInput & { id: string }) =>
      api.patch<StaffMember>(`/ops/staff/${id}`, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: securityKeys.staffAll });
      // Editing your own roles changes what the nav shows.
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useResetStaffMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<StaffMember>(`/ops/staff/${id}/reset-mfa`),
    onSettled: () => qc.invalidateQueries({ queryKey: securityKeys.staffAll }),
  });
}

// ---------------------------------------------------------------- system
export function useSystemHealth() {
  return useQuery({
    queryKey: securityKeys.health,
    queryFn: ({ signal }) => api.get<SystemHealth>("/ops/system/health", undefined, signal),
    refetchInterval: 60_000,
  });
}

export function useFailedTasks(q: { status: FailedTaskStatus; page: number }) {
  return useQuery({
    queryKey: securityKeys.failedTasks(q),
    queryFn: ({ signal }) =>
      api.get<FailedTaskPage>(
        "/ops/system/failed-tasks",
        { status: q.status, page: q.page },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useFailedTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "retry" | "dismiss" }) =>
      api.post<FailedTask>(`/ops/system/failed-tasks/${id}/${action}`),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: securityKeys.failedTasksAll });
      void qc.invalidateQueries({ queryKey: securityKeys.health });
    },
  });
}
