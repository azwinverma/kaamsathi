"use client";
/** Hooks for the training area (docs/CONTRACT-ECOSYSTEM.md §4). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  Course,
  CourseInput,
  Enrollment,
  EnrollmentStatus,
  OutcomesResponse,
  ProviderInput,
  ProviderVerifyInput,
  SessionAttendanceSheet,
  SessionInput,
  ShortagesResponse,
  SponsorResult,
  TrainingProvider,
  TrainingSession,
} from "../types-training";

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const trainingKeys = {
  opsAll: ["ops", "training"] as const,
  providersAll: ["ops", "training", "providers"] as const,
  providers: (q?: QueryParams) => ["ops", "training", "providers", q ?? {}] as const,
  coursesAll: ["ops", "training", "courses"] as const,
  courses: (q?: QueryParams) => ["ops", "training", "courses", q ?? {}] as const,
  enrollmentsAll: ["ops", "training", "enrollments"] as const,
  enrollments: (q?: QueryParams) => ["ops", "training", "enrollments", q ?? {}] as const,
  shortages: (q?: QueryParams) => ["ops", "training", "shortages", q ?? {}] as const,
  sessions: (courseId: string) => ["ops", "training", "sessions", courseId] as const,
  sessionAttendance: (sessionId: string) =>
    ["ops", "training", "session-attendance", sessionId] as const,
  outcomes: (q?: QueryParams) => ["ops", "training", "outcomes", q ?? {}] as const,
  orgCourses: (q?: QueryParams) => ["org", "training", "courses", q ?? {}] as const,
  orgEnrollmentsAll: ["org", "training", "enrollments"] as const,
  orgEnrollments: (q?: QueryParams) => ["org", "training", "enrollments", q ?? {}] as const,
  meCourses: (q?: QueryParams) => ["me", "courses", q ?? {}] as const,
  meEnrollments: ["me", "enrollments"] as const,
};

// ---------------------------------------------------------------- ops: providers
export function useOpsProviders(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.providers(params),
    queryFn: () => api.get<Paginated<TrainingProvider>>("/ops/training/providers", params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ProviderInput & { id?: string }) =>
      id
        ? api.patch<TrainingProvider>(`/ops/training/providers/${id}`, body)
        : api.post<TrainingProvider>("/ops/training/providers", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.opsAll }),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ops/training/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.opsAll }),
  });
}

/** T002 — verified / rejected (note required) / back to pending. Audited server-side. */
export function useVerifyProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ProviderVerifyInput & { id: string }) =>
      api.post<TrainingProvider>(`/ops/training/providers/${id}/verify`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.opsAll }),
  });
}

// ---------------------------------------------------------------- ops: courses
export function useOpsCourses(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.courses(params),
    queryFn: () => api.get<Paginated<Course>>("/ops/training/courses", params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CourseInput> & { id?: string }) =>
      id
        ? api.patch<Course>(`/ops/training/courses/${id}`, body)
        : api.post<Course>("/ops/training/courses", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.opsAll }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ops/training/courses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.opsAll }),
  });
}

// ---------------------------------------------------------------- ops: sessions (T006)
export function useCourseSessions(courseId: string | null) {
  return useQuery({
    queryKey: trainingKeys.sessions(courseId ?? ""),
    queryFn: () => api.get<TrainingSession[]>(`/ops/training/courses/${courseId}/sessions`),
    enabled: !!courseId,
  });
}

export function useSaveSession(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SessionInput & { id?: string }) =>
      id
        ? api.patch<TrainingSession>(`/ops/training/sessions/${id}`, body)
        : api.post<TrainingSession>(`/ops/training/courses/${courseId}/sessions`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.sessions(courseId) }),
  });
}

export function useDeleteSession(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ops/training/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.sessions(courseId) });
      qc.invalidateQueries({ queryKey: trainingKeys.enrollmentsAll });
    },
  });
}

export function useSessionAttendance(sessionId: string | null) {
  return useQuery({
    queryKey: trainingKeys.sessionAttendance(sessionId ?? ""),
    queryFn: () =>
      api.get<SessionAttendanceSheet>(`/ops/training/sessions/${sessionId}/attendance`),
    enabled: !!sessionId,
  });
}

export function useSaveSessionAttendance(sessionId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: { enrollment_id: string; present: boolean }[]) =>
      api.put<SessionAttendanceSheet>(`/ops/training/sessions/${sessionId}/attendance`, {
        records,
      }),
    onSuccess: (sheet) => {
      qc.setQueryData(trainingKeys.sessionAttendance(sessionId), sheet);
      qc.invalidateQueries({ queryKey: trainingKeys.sessions(courseId) });
      qc.invalidateQueries({ queryKey: trainingKeys.enrollmentsAll });
    },
  });
}

// ---------------------------------------------------------------- ops: outcomes (T010)
export function useTrainingOutcomes(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.outcomes(params),
    queryFn: () => api.get<OutcomesResponse>("/ops/training/outcomes", params),
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------- ops: enrolments & shortages
export function useOpsEnrollments(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.enrollments(params),
    queryFn: () => api.get<Paginated<Enrollment>>("/ops/training/enrollments", params),
    placeholderData: keepPreviousData,
  });
}

/** Moving to `completed` creates a verified training Credential for the worker. */
export function useSetEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      status: EnrollmentStatus;
      completed_on?: string;
    }) => api.post<Enrollment>(`/ops/training/enrollments/${id}/status`, body),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: trainingKeys.opsAll });
      qc.invalidateQueries({ queryKey: ["ops", "workers", "detail", e.worker.id, "credentials"] });
    },
  });
}

export function useShortages(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.shortages(params),
    queryFn: () => api.get<ShortagesResponse>("/ops/training/shortages", params),
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------- employer
export function useOrgCourses(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.orgCourses(params),
    queryFn: () => api.get<Paginated<Course>>("/org/courses", params),
    placeholderData: keepPreviousData,
  });
}

export function useOrgEnrollments(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.orgEnrollments(params),
    queryFn: () => api.get<Paginated<Enrollment>>("/org/enrollments", params),
    placeholderData: keepPreviousData,
  });
}

export function useSponsorEnrollments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { course_id: string; worker_ids: string[] }) =>
      api.post<SponsorResult>("/org/enrollments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.orgEnrollmentsAll });
      qc.invalidateQueries({ queryKey: ["org", "training", "courses"] });
    },
  });
}

// ---------------------------------------------------------------- worker self-service
export function useMyCourses(params?: QueryParams) {
  return useQuery({
    queryKey: trainingKeys.meCourses(params),
    queryFn: () => api.get<Paginated<Course>>("/me/courses", params),
    placeholderData: keepPreviousData,
  });
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: trainingKeys.meEnrollments,
    queryFn: () => api.get<Paginated<Enrollment>>("/me/enrollments"),
  });
}

export function useEnrollCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post<Enrollment>("/me/enrollments", { course_id: courseId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingKeys.meEnrollments }),
  });
}
