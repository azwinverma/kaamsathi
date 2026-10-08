"use client";
/** Hiring pipeline extensions: invite (L004), tags/assignee (L008/L009), interviews (L010),
 * ops match runs / owner (K010/L009) and the matching config (K001). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import { qk } from "../keys";
import type { Application, Match, OpsJob, Paginated, UUID, WorkerCard } from "../types";
import type {
  ApplicationPatch,
  ApplicationTagCount,
  InviteInput,
  Interview,
  InterviewInput,
  InterviewPatch,
  MatchRun,
  MatchRunDetail,
  MatchingConfig,
  MatchingWeights,
} from "../types-pipeline";

/** Local query keys (org data stays under ["org", …] so an org switch resets it). */
export const pk = {
  inviteCandidates: (jobId: string, q?: QueryParams) =>
    ["org", "jobs", jobId, "invite-candidates", q ?? {}] as const,
  applicationTags: ["org", "application-tags"] as const,
  matchRuns: (jobId: string, q?: QueryParams) =>
    ["ops", "jobs", jobId, "match-runs", q ?? {}] as const,
  matchRunsAll: (jobId: string) => ["ops", "jobs", jobId, "match-runs"] as const,
  matchRun: (jobId: string, runId: string) => ["ops", "jobs", jobId, "match-run", runId] as const,
  matchingConfig: ["ops", "matching", "config"] as const,
};

// ---------------------------------------------------------------- L004 employer invite
export function useInviteCandidates(
  jobId: string | undefined,
  params?: QueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: pk.inviteCandidates(jobId ?? "", params),
    queryFn: () => api.get<Paginated<WorkerCard>>(`/org/jobs/${jobId}/invite-candidates`, params),
    enabled: !!jobId && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInviteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...body }: InviteInput & { jobId: string }) =>
      api.post<Application>(`/org/jobs/${jobId}/invite`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
      qc.invalidateQueries({ queryKey: qk.org.jobsAll });
    },
  });
}

// ---------------------------------------------------------------- L008 / L009
export function useApplicationTags(enabled = true) {
  return useQuery({
    queryKey: pk.applicationTags,
    queryFn: () => api.get<ApplicationTagCount[]>("/org/application-tags"),
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ApplicationPatch & { id: string }) =>
      api.patch<Application>(`/org/applications/${id}`, body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: qk.org.application(vars.id) });
      qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
      if (vars.tags) qc.invalidateQueries({ queryKey: pk.applicationTags });
    },
  });
}

// ---------------------------------------------------------------- L010 interviews
function invalidateApplication(qc: ReturnType<typeof useQueryClient>, applicationId: string) {
  qc.invalidateQueries({ queryKey: qk.org.application(applicationId) });
  qc.invalidateQueries({ queryKey: qk.org.applicationsAll });
  qc.invalidateQueries({ queryKey: qk.org.jobsAll });
}

export function useScheduleInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...body }: InterviewInput & { applicationId: string }) =>
      api.post<Interview>(`/org/applications/${applicationId}/interviews`, body),
    onSuccess: (_res, vars) => invalidateApplication(qc, vars.applicationId),
  });
}

export function useUpdateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      applicationId: _applicationId,
      ...patch
    }: InterviewPatch & { id: string; applicationId: string }) =>
      api.patch<Interview>(`/org/interviews/${id}`, patch),
    onSuccess: (_res, vars) => invalidateApplication(qc, vars.applicationId),
  });
}

export function useDeleteInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; applicationId: string }) =>
      api.delete(`/org/interviews/${id}`),
    onSuccess: (_res, vars) => invalidateApplication(qc, vars.applicationId),
  });
}

// ---------------------------------------------------------------- ops: matches, runs, owner
/** Re-score now (`?refresh=1`) and put the fresh rows into the matches cache. */
export function useRefreshMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, limit }: { jobId: string; limit: number }) =>
      api.get<Match[]>(`/ops/jobs/${jobId}/matches`, { limit, refresh: 1 }),
    onSuccess: (rows, vars) => {
      qc.setQueryData(qk.ops.matches(vars.jobId, vars.limit), rows);
      qc.invalidateQueries({ queryKey: pk.matchRunsAll(vars.jobId) });
    },
  });
}

export function useMatchRuns(jobId: string | undefined, params?: QueryParams) {
  return useQuery({
    queryKey: pk.matchRuns(jobId ?? "", params),
    queryFn: () => api.get<Paginated<MatchRun>>(`/ops/jobs/${jobId}/match-runs`, params),
    enabled: !!jobId,
    placeholderData: keepPreviousData,
  });
}

export function useMatchRun(jobId: string | undefined, runId: string | null | undefined) {
  return useQuery({
    queryKey: pk.matchRun(jobId ?? "", runId ?? ""),
    queryFn: () => api.get<MatchRunDetail>(`/ops/jobs/${jobId}/match-runs/${runId}`),
    enabled: !!jobId && !!runId,
    staleTime: Infinity,
  });
}

export function useSetOpsJobOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, user_id }: { jobId: string; user_id: UUID | null }) =>
      api.post<OpsJob>(`/ops/jobs/${jobId}/owner`, { user_id }),
    onSuccess: (job, vars) => {
      if (job?.id) qc.setQueryData(qk.ops.job(job.id), job);
      else qc.invalidateQueries({ queryKey: qk.ops.job(vars.jobId) });
      qc.invalidateQueries({ queryKey: ["ops", "jobs", "list"] });
    },
  });
}

// ---------------------------------------------------------------- K001 matching config
export function useMatchingConfig(enabled = true) {
  return useQuery({
    queryKey: pk.matchingConfig,
    queryFn: () => api.get<MatchingConfig>("/ops/matching/config"),
    enabled,
  });
}

export function useUpdateMatchingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weights: Partial<MatchingWeights>) =>
      api.patch<MatchingConfig>("/ops/matching/config", { weights }),
    onSuccess: (cfg) => {
      qc.setQueryData(pk.matchingConfig, cfg);
    },
  });
}

export function useResetMatchingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MatchingConfig>("/ops/matching/config/reset"),
    onSuccess: (cfg) => {
      if (cfg) qc.setQueryData(pk.matchingConfig, cfg);
      else qc.invalidateQueries({ queryKey: pk.matchingConfig });
    },
  });
}
