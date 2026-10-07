"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, request } from "../client";
import { ApiError, parseApiError } from "../errors";
import { qk } from "../keys";
import type { Me, OtpRequestResponse } from "../types";

/** Current user via the proxy (/auth/me). */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<Me>("/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
    enabled,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<Me, "full_name" | "email" | "preferred_language">>) =>
      api.patch<Me>("/auth/me", body),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

async function bff<T>(path: string, body?: unknown): Promise<T> {
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

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => bff<OtpRequestResponse>("/api/auth/otp/request", { phone }),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; code: string }) =>
      bff<{ user: Me }>("/api/auth/otp/verify", input),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(qk.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bff<{ ok: boolean }>("/api/auth/logout"),
    onSettled: () => qc.clear(),
  });
}

/** Re-export for rare direct use. */
export { request };
