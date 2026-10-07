"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryParams } from "../client";
import { qk } from "../keys";
import type {
  BillingSummary,
  ChargeListItem,
  Dashboard,
  Holiday,
  HolidayInput,
  HolidayListItem,
  Member,
  MemberCreate,
  MemberUpdate,
  Organization,
  OrganizationCreate,
  OrganizationUpdate,
  Paginated,
  Shift,
  ShiftInput,
  Site,
  SiteInput,
} from "../types";

type List<T> = Paginated<T> | T[];

// ------------------------------------------------------------- organizations
export function useMyOrgs() {
  return useQuery({ queryKey: qk.orgs, queryFn: () => api.get<List<Organization>>("/orgs") });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationCreate) => api.post<Organization>("/orgs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orgs });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useOrg() {
  return useQuery({ queryKey: qk.org.detail, queryFn: () => api.get<Organization>("/org") });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationUpdate) => api.patch<Organization>("/org", body),
    onSuccess: (org) => {
      qc.setQueryData(qk.org.detail, org);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: qk.org.dashboard,
    queryFn: () => api.get<Dashboard>("/org/dashboard"),
    refetchInterval: 60_000,
  });
}

// ------------------------------------------------------------- members
export function useMembers() {
  return useQuery({
    queryKey: qk.org.members,
    queryFn: () => api.get<List<Member>>("/org/members", { page_size: 100 }),
  });
}
export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MemberCreate) => api.post<Member>("/org/members", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.members }),
  });
}
export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MemberUpdate & { id: string }) =>
      api.patch<Member>(`/org/members/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.members }),
  });
}
export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.members }),
  });
}

// ------------------------------------------------------------- sites
export function useSites(params?: QueryParams) {
  return useQuery({
    queryKey: [...qk.org.sites, params ?? {}],
    queryFn: () => api.get<List<Site>>("/org/sites", { page_size: 100, ...params }),
  });
}
export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiteInput) => api.post<Site>("/org/sites", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.sites }),
  });
}
export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<SiteInput> & { id: string }) =>
      api.patch<Site>(`/org/sites/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.sites }),
  });
}
export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.sites }),
  });
}
export function useRotateSiteQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Site>(`/org/sites/${id}/rotate-qr`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.sites }),
  });
}

// ------------------------------------------------------------- shifts
export function useShifts() {
  return useQuery({
    queryKey: qk.org.shifts,
    queryFn: () => api.get<List<Shift>>("/org/shifts", { page_size: 100 }),
  });
}
export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShiftInput) => api.post<Shift>("/org/shifts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.shifts }),
  });
}
export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ShiftInput> & { id: string }) =>
      api.patch<Shift>(`/org/shifts/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.shifts }),
  });
}
export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.org.shifts }),
  });
}

// ------------------------------------------------------------- holidays
export function useHolidays(bsYear?: number) {
  return useQuery({
    queryKey: qk.org.holidays(bsYear),
    queryFn: () => api.get<List<HolidayListItem>>("/org/holidays", { bs_year: bsYear, page_size: 100 }),
  });
}
export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HolidayInput) => api.post<Holiday>("/org/holidays", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org", "holidays"] }),
  });
}
export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org", "holidays"] }),
  });
}

// ------------------------------------------------------------- billing
export function useBillingSummary() {
  return useQuery({
    queryKey: qk.org.billingSummary,
    queryFn: () => api.get<BillingSummary>("/org/billing/summary"),
  });
}
export function useCharges(params?: QueryParams) {
  return useQuery({
    queryKey: qk.org.charges(params),
    queryFn: () => api.get<List<ChargeListItem>>("/org/billing/charges", params),
  });
}
