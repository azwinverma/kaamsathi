"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, request, type QueryParams } from "../client";
import { qk } from "../keys";
import { track } from "../../telemetry";
import type {
  Match,
  OpsDashboard,
  OpsJob,
  OpsOrganization,
  OpsOrganizationDetail,
  OpsShortlistResult,
  OpsWorker,
  OpsWorkerDocField,
  OpsWorkerInput,
  Paginated,
} from "../types";

type List<T> = Paginated<T> | T[];

export function useOpsDashboard() {
  return useQuery({
    queryKey: qk.ops.dashboard,
    queryFn: () => api.get<OpsDashboard>("/ops/dashboard"),
  });
}

export function useOpsWorkers(params?: QueryParams) {
  return useQuery({
    queryKey: qk.ops.workers(params),
    queryFn: () => api.get<Paginated<OpsWorker>>("/ops/workers", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsWorker(id: string | undefined | null) {
  return useQuery({
    queryKey: qk.ops.worker(id ?? ""),
    queryFn: () => api.get<OpsWorker>(`/ops/workers/${id}`),
    enabled: !!id,
  });
}

export function useCreateOpsWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpsWorkerInput) => api.post<OpsWorker>("/ops/workers", body),
    onSuccess: (w) => {
      qc.setQueryData(qk.ops.worker(w.id), w);
      qc.invalidateQueries({ queryKey: qk.ops.workersAll });
      qc.invalidateQueries({ queryKey: qk.ops.dashboard });
    },
  });
}

export function useUpdateOpsWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<OpsWorkerInput> & { id: string }) =>
      api.patch<OpsWorker>(`/ops/workers/${id}`, body),
    onSuccess: (w) => {
      qc.setQueryData(qk.ops.worker(w.id), w);
      qc.invalidateQueries({ queryKey: qk.ops.workersAll });
    },
  });
}

/** Upload ID front/back or photo (multipart PATCH /ops/workers/{id}). */
export function useUploadOpsWorkerDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, field, file }: { id: string; field: OpsWorkerDocField; file: File }) => {
      const form = new FormData();
      form.append(field, file);
      return request<OpsWorker>("PATCH", `/ops/workers/${id}`, { body: form });
    },
    onSuccess: (w) => {
      qc.setQueryData(qk.ops.worker(w.id), w);
      qc.invalidateQueries({ queryKey: qk.ops.workersAll });
    },
  });
}

export function useVerifyWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: "verified" | "rejected"; note?: string }) =>
      api.post<OpsWorker>(`/ops/workers/${id}/verify`, body),
    onSuccess: (w, vars) => {
      // result = the status after the decision ("pending" while a four-eyes second review is due).
      track("feature_used", {
        feature: "worker_verification",
        status: vars.status,
        result: w?.verification_status,
      });
      if (w?.id) qc.setQueryData(qk.ops.worker(w.id), w);
      qc.invalidateQueries({ queryKey: qk.ops.workersAll });
      qc.invalidateQueries({ queryKey: qk.ops.dashboard });
    },
  });
}

export function useOpsJobs(params?: QueryParams) {
  return useQuery({
    queryKey: qk.ops.jobs(params),
    queryFn: () => api.get<List<OpsJob>>("/ops/jobs", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsJob(id: string | undefined | null) {
  return useQuery({
    queryKey: qk.ops.job(id ?? ""),
    queryFn: () => api.get<OpsJob>(`/ops/jobs/${id}`),
    enabled: !!id,
  });
}

export function useJobMatches(jobId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: qk.ops.matches(jobId ?? "", limit),
    queryFn: () => api.get<Match[]>(`/ops/jobs/${jobId}/matches`, { limit }),
    enabled: !!jobId,
    placeholderData: keepPreviousData,
  });
}

export function useShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, worker_ids }: { jobId: string; worker_ids: string[] }) =>
      api.post<OpsShortlistResult>(`/ops/jobs/${jobId}/shortlist`, { worker_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops", "jobs"] });
      qc.invalidateQueries({ queryKey: qk.ops.dashboard });
      qc.invalidateQueries({ queryKey: ["ops", "organizations"] });
    },
  });
}

export function useOpsOrganizations(params?: QueryParams) {
  return useQuery({
    queryKey: qk.ops.organizations(params),
    queryFn: () => api.get<List<OpsOrganization>>("/ops/organizations", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsOrganization(id: string | undefined | null) {
  return useQuery({
    queryKey: qk.ops.organization(id ?? ""),
    queryFn: () => api.get<OpsOrganizationDetail>(`/ops/organizations/${id}`),
    enabled: !!id,
  });
}
