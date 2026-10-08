"use client";
/** Hooks for the support area (docs/CONTRACT-EXTENSIONS.md §2). Query keys live in this file.
 *
 * The same case/thread hooks serve three audiences, picked by `scope`:
 * `org` → /org/support-cases (employer members), `me` → /me/support-cases, `ops` → /ops/support-cases.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  CaseMessage,
  HelpArticle,
  HelpArticleInput,
  IdentityMethod,
  SupportCase,
  SupportCaseInput,
  SupportCaseUpdateInput,
  SupportLookupResult,
  SupportScope,
  WorkerSensitiveUpdateInput,
} from "../types-support";

const BASE: Record<SupportScope, string> = {
  org: "/org/support-cases",
  me: "/me/support-cases",
  ops: "/ops/support-cases",
};

/** Org-scoped keys live under ["org", …] so they reset on org switch. */
export const supportKeys = {
  all: (scope: SupportScope) => [scope, "support-cases"] as const,
  list: (scope: SupportScope, q?: QueryParams) =>
    [scope, "support-cases", "list", q ?? {}] as const,
  detail: (scope: SupportScope, id: string) => [scope, "support-cases", "detail", id] as const,
  messages: (scope: SupportScope, id: string) => [scope, "support-cases", "messages", id] as const,
  lookup: (q: QueryParams) => ["ops", "support", "lookup", q] as const,
  helpPublic: (q?: QueryParams) => ["help", "articles", q ?? {}] as const,
  helpArticle: (slug: string) => ["help", "article", slug] as const,
  helpOpsAll: ["ops", "help-articles"] as const,
  helpOps: (q?: QueryParams) => ["ops", "help-articles", q ?? {}] as const,
};

export function useSupportCases(scope: SupportScope, params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: supportKeys.list(scope, params),
    queryFn: () => api.get<Paginated<SupportCase>>(BASE[scope], params),
    placeholderData: keepPreviousData,
    enabled,
    // queues show SLA countdowns: keep them reasonably fresh
    refetchInterval: scope === "ops" ? 60_000 : false,
  });
}

export function useSupportCase(scope: SupportScope, id: string | null) {
  return useQuery({
    queryKey: supportKeys.detail(scope, id ?? ""),
    queryFn: () => api.get<SupportCase>(`${BASE[scope]}/${id}`),
    enabled: !!id,
  });
}

export function useCaseMessages(scope: SupportScope, id: string | null) {
  return useQuery({
    queryKey: supportKeys.messages(scope, id ?? ""),
    queryFn: () => api.get<CaseMessage[]>(`${BASE[scope]}/${id}/messages`),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useCreateSupportCase(scope: Exclude<SupportScope, "ops">) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SupportCaseInput) => api.post<SupportCase>(BASE[scope], body),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.all(scope) }),
  });
}

export function usePostCaseMessage(scope: SupportScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; body: string; internal?: boolean; channel?: "web" | "phone" }) =>
      api.post<CaseMessage>(`${BASE[scope]}/${id}/messages`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: supportKeys.messages(scope, vars.id) });
      qc.invalidateQueries({ queryKey: supportKeys.all(scope) });
    },
  });
}

export function useUpdateSupportCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SupportCaseUpdateInput) =>
      api.patch<SupportCase>(`${BASE.ops}/${id}`, body),
    onSuccess: (data) => {
      qc.setQueryData(supportKeys.detail("ops", data.id), data);
      qc.invalidateQueries({ queryKey: supportKeys.all("ops") });
    },
  });
}

function useCaseDetailUpdate() {
  const qc = useQueryClient();
  return (data: SupportCase) => {
    qc.setQueryData(supportKeys.detail("ops", data.id), data);
    qc.invalidateQueries({ queryKey: supportKeys.all("ops") });
    qc.invalidateQueries({ queryKey: supportKeys.messages("ops", data.id) });
  };
}

// ---------------------------------------------------------------- contact center (ops)
export function useSupportLookup(params: QueryParams, enabled: boolean) {
  return useQuery({
    queryKey: supportKeys.lookup(params),
    queryFn: () => api.get<SupportLookupResult>("/ops/support/lookup", params),
    enabled,
    retry: false,
  });
}

export function useIdentityCheck() {
  const update = useCaseDetailUpdate();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      method: IdentityMethod;
      result: "passed" | "failed";
    }) => api.post<SupportCase>(`${BASE.ops}/${id}/identity-check`, body),
    onSuccess: update,
  });
}

export function useWorkerSensitiveUpdate() {
  const update = useCaseDetailUpdate();
  return useMutation({
    mutationFn: ({ id, ...body }: WorkerSensitiveUpdateInput & { id: string }) =>
      api.post<{ updated: string[]; case: SupportCase }>(`${BASE.ops}/${id}/worker-update`, body),
    onSuccess: (data) => update(data.case),
  });
}

// ---------------------------------------------------------------- help center
export function useHelpArticles(params?: QueryParams) {
  return useQuery({
    queryKey: supportKeys.helpPublic(params),
    queryFn: () => api.get<HelpArticle[]>("/help/articles", params),
    placeholderData: keepPreviousData,
  });
}

export function useHelpArticle(slug: string) {
  return useQuery({
    queryKey: supportKeys.helpArticle(slug),
    queryFn: () => api.get<HelpArticle>(`/help/articles/${slug}`),
    enabled: !!slug,
  });
}

export function useOpsHelpArticles(params?: QueryParams) {
  return useQuery({
    queryKey: supportKeys.helpOps(params),
    queryFn: () =>
      api.get<Paginated<HelpArticle>>("/ops/help/articles", { page_size: 100, ...params }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateHelp() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: supportKeys.helpOpsAll });
    qc.invalidateQueries({ queryKey: ["help"] });
  };
}

export function useSaveHelpArticle() {
  const invalidate = useInvalidateHelp();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<HelpArticleInput> & { id?: string }) =>
      id
        ? api.patch<HelpArticle>(`/ops/help/articles/${id}`, body)
        : api.post<HelpArticle>("/ops/help/articles", body),
    onSuccess: invalidate,
  });
}

export function useDeleteHelpArticle() {
  const invalidate = useInvalidateHelp();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ops/help/articles/${id}`),
    onSuccess: invalidate,
  });
}
