"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { FeatureFlag, FeatureFlagInput, FeatureFlagList } from "../types";

/** Client-visible feature flags for the signed-in user (and current org): GET /flags. */
export const clientFlagsKey = ["flags"] as const;
export const opsFlagsKey = ["ops", "flags"] as const;

export function useClientFlags() {
  return useQuery({
    queryKey: clientFlagsKey,
    queryFn: () => api.get<{ flags: Record<string, boolean> }>("/flags"),
    staleTime: 60_000,
  });
}

/** `true` only when the flag is client-visible and on for this user/org. */
export function useFlag(key: string): boolean {
  const { data } = useClientFlags();
  return !!data?.flags?.[key];
}

export function useOpsFlags() {
  return useQuery({ queryKey: opsFlagsKey, queryFn: () => api.get<FeatureFlagList>("/ops/flags") });
}

export function useSaveFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ create, ...body }: FeatureFlagInput & { key: string; create?: boolean }) =>
      create
        ? api.post<FeatureFlag>("/ops/flags", body)
        : api.patch<FeatureFlag>(`/ops/flags/${body.key}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsFlagsKey });
      qc.invalidateQueries({ queryKey: clientFlagsKey });
    },
  });
}

export function useDeleteFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(`/ops/flags/${key}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsFlagsKey });
      qc.invalidateQueries({ queryKey: clientFlagsKey });
    },
  });
}
