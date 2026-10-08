"use client";
/** Hooks for trade aliases (F004) and rating moderation (N004). Query keys live in this file. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type {
  OpsRating,
  OpsRatingsPage,
  OrgReceivedRating,
  OrgReceivedRatings,
  TradeAlias,
  TradeAliasInput,
} from "../types-moderation";

export const moderationKeys = {
  /** Same prefix as the ops taxonomy trade list (aliases are embedded in each trade). */
  taxonomyTrades: ["ops", "taxonomy", "trades"] as const,
  opsRatingsAll: ["ops", "ratings"] as const,
  opsRatings: (q?: QueryParams) => ["ops", "ratings", "list", q ?? {}] as const,
  /** Org-scoped keys live under ["org", …] so they reset on org switch. */
  orgRatingsReceived: ["org", "ratings", "received"] as const,
};

// ---------------------------------------------------------------- trade aliases (superadmin)
export function useAddTradeAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, ...body }: TradeAliasInput & { code: string }) =>
      api.post<TradeAlias>(`/ops/taxonomy/trades/${code}/aliases`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: moderationKeys.taxonomyTrades }),
  });
}

export function useDeleteTradeAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, id }: { code: string; id: string }) =>
      api.delete(`/ops/taxonomy/trades/${code}/aliases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: moderationKeys.taxonomyTrades }),
  });
}

// ---------------------------------------------------------------- ops rating moderation
export function useOpsRatings(params?: QueryParams) {
  return useQuery({
    queryKey: moderationKeys.opsRatings(params),
    queryFn: () => api.get<OpsRatingsPage>("/ops/ratings", params),
    placeholderData: keepPreviousData,
  });
}

export type RatingModerationAction = "hide" | "restore" | "void";

export function useModerateRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, text }: { id: string; action: RatingModerationAction; text?: string }) =>
      api.post<OpsRating>(
        `/ops/ratings/${id}/${action}`,
        action === "void" ? { reason: text ?? "" } : { note: text ?? "" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: moderationKeys.opsRatingsAll }),
  });
}

// ---------------------------------------------------------------- employer
export function useOrgRatingsReceived(enabled = true) {
  return useQuery({
    queryKey: moderationKeys.orgRatingsReceived,
    queryFn: () => api.get<OrgReceivedRatings>("/org/ratings/received"),
    enabled,
  });
}

export function useFlagOrgRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<OrgReceivedRating>(`/org/ratings/${id}/flag`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: moderationKeys.orgRatingsReceived }),
  });
}
