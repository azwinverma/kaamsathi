"use client";
/** Hooks for billing: employer invoices/subscription and the ops billing console. Keys live here. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import type { Paginated } from "../types";
import type {
  BillingPlan,
  BillingSubscription,
  CreditNote,
  Invoice,
  InvoiceDetail,
  InvoicePayment,
  PaymentInput,
  PlanInput,
  SubscriptionStatus,
} from "../types-billing";

export const billingKeys = {
  org: ["org", "billing"] as const,
  orgSubscription: ["org", "billing", "subscription"] as const,
  orgInvoices: (q?: QueryParams) => ["org", "billing", "invoices", q ?? {}] as const,
  orgInvoice: (id: string) => ["org", "billing", "invoice", id] as const,
  ops: ["ops", "billing"] as const,
  plans: ["ops", "billing", "plans"] as const,
  invoices: (q?: QueryParams) => ["ops", "billing", "invoices", q ?? {}] as const,
  invoice: (id: string) => ["ops", "billing", "invoice", id] as const,
};

// ------------------------------------------------------------------ employer
export function useOrgSubscription() {
  return useQuery({
    queryKey: billingKeys.orgSubscription,
    queryFn: () => api.get<BillingSubscription>("/org/billing/subscription"),
  });
}

export function useOrgInvoices(params?: QueryParams) {
  return useQuery({
    queryKey: billingKeys.orgInvoices(params),
    queryFn: () => api.get<Paginated<Invoice>>("/org/billing/invoices", params),
    placeholderData: keepPreviousData,
  });
}

export function useOrgInvoice(id: string | null) {
  return useQuery({
    queryKey: billingKeys.orgInvoice(id ?? ""),
    queryFn: () => api.get<InvoiceDetail>(`/org/billing/invoices/${id}`),
    enabled: !!id,
  });
}

// ------------------------------------------------------------------ ops
export function useBillingPlans() {
  return useQuery({ queryKey: billingKeys.plans, queryFn: () => api.get<BillingPlan[]>("/ops/billing/plans") });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, ...body }: PlanInput & { code: string }) =>
      api.patch<BillingPlan>(`/ops/billing/plans/${code}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.plans }),
  });
}

export function useOpsInvoices(params?: QueryParams) {
  return useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: () => api.get<Paginated<Invoice>>("/ops/billing/invoices", params),
    placeholderData: keepPreviousData,
  });
}

export function useOpsInvoice(id: string | null) {
  return useQuery({
    queryKey: billingKeys.invoice(id ?? ""),
    queryFn: () => api.get<InvoiceDetail>(`/ops/billing/invoices/${id}`),
    enabled: !!id,
  });
}

function useOpsMutation<TVars, TOut>(fn: (v: TVars) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.ops }) });
}

export function useGenerateInvoices() {
  return useOpsMutation((body: { bs_year: number; bs_month: number }) =>
    api.post<{ count: number; invoices: Invoice[] }>("/ops/billing/invoices/generate", body),
  );
}

export function useIssueInvoice() {
  return useOpsMutation((id: string) => api.post<InvoiceDetail>(`/ops/billing/invoices/${id}/issue`));
}

export function useVoidInvoice() {
  return useOpsMutation(({ id, reason }: { id: string; reason: string }) =>
    api.post<InvoiceDetail>(`/ops/billing/invoices/${id}/void`, { reason }),
  );
}

export function useRecordPayment() {
  return useOpsMutation(({ id, ...body }: PaymentInput & { id: string }) =>
    api.post<{ payment: InvoicePayment; invoice: InvoiceDetail }>(`/ops/billing/invoices/${id}/payments`, body),
  );
}

export function useCreateCreditNote() {
  return useOpsMutation(({ id, amount, reason }: { id: string; amount: string; reason: string }) =>
    api.post<{ credit_note: CreditNote; invoice: InvoiceDetail }>(`/ops/billing/invoices/${id}/credit-notes`, {
      amount,
      reason,
    }),
  );
}

export function useSetSubscription() {
  return useOpsMutation(({ orgId, plan, status }: { orgId: string; plan: string; status?: SubscriptionStatus }) =>
    api.patch<BillingSubscription>(`/ops/billing/subscriptions/${orgId}`, { plan, status: status ?? "active" }),
  );
}
