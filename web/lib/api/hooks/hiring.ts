"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import { qk } from "../keys";
import { track } from "../../telemetry";
import type {
  Application,
  ApplicationDetail,
  Job,
  JobInput,
  MoveInput,
  Paginated,
} from "../types";

export function useJobs(params?: QueryParams) {
  return useQuery({
    queryKey: qk.org.jobs(params),
    queryFn: () => api.get<Paginated<Job>>("/org/jobs", params),
    placeholderData: keepPreviousData,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: qk.org.job(id ?? ""),
    queryFn: () => api.get<Job>(`/org/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: JobInput) => api.post<Job>("/org/jobs", body),
    onSuccess: (job) => {
      track("job_created", { job_id: job.id, wage_type: job.wage_type, status: job.status });
      return qc.invalidateQueries({ queryKey: qk.org.jobsAll });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<JobInput> & { id: string }) =>
      api.patch<Job>(`/org/jobs/${id}`, body),
    onSuccess: (job) => {
      qc.setQueryData(qk.org.job(job.id), job);
      qc.invalidateQueries({ queryKey: qk.org.jobsAll });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.jobsAll }),
  });
}

function useJobAction(action: "publish" | "close" | "pause" | "resume") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Job>(`/org/jobs/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.jobsAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
    },
  });
}
export const usePublishJob = () => useJobAction("publish");
export const useCloseJob = () => useJobAction("close");
/** J006: open → paused. */
export const usePauseJob = () => useJobAction("pause");
/** J006: paused → open. */
export const useResumeJob = () => useJobAction("resume");

export function useApplications(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: qk.org.applications(params),
    queryFn: () => api.get<Paginated<Application>>("/org/applications", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useApplication(id: string | undefined | null) {
  return useQuery({
    queryKey: qk.org.application(id ?? ""),
    queryFn: () => api.get<ApplicationDetail>(`/org/applications/${id}`),
    enabled: !!id,
  });
}

export function useMoveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MoveInput & { id: string }) =>
      api.post<{ application: Application; employment_id?: string }>(
        `/org/applications/${id}/move`,
        body,
      ),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
      qc.invalidateQueries({ queryKey: qk.org.application(vars.id) });
      qc.invalidateQueries({ queryKey: qk.org.jobsAll });
      qc.invalidateQueries({ queryKey: qk.org.dashboard });
      if (vars.stage === "joined") qc.invalidateQueries({ queryKey: qk.org.employmentsAll });
    },
  });
}
