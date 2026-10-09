"use client";
/**
 * Bolau hooks (docs/CONTRACT-BOLAU.md): discovery, Ghardhani bookings/requests/addresses/favourites,
 * Sipalu self-profile + onboarding, and the ops console. Query keys are local (`bk`).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, request, type QueryParams } from "../client";
import { ApiError } from "../errors";
import type { Dispute } from "../types-trust";
import type { Paginated } from "../types";
import type {
  Address,
  AddressInput,
  AvailabilityRule,
  BolauConfig,
  BolauSearchParams,
  BolauTrade,
  Booking,
  BookingContact,
  BookingInput,
  Favourite,
  FeeLedgerRow,
  GhardhaniProfile,
  KaamRequest,
  OnboardingResult,
  OpsBolauKpis,
  OpsBooking,
  OpsSipaluRow,
  PayMethod,
  PublicSipalu,
  RatingInput,
  SipaluCard,
  SipaluMe,
  SipaluService,
  SipaluServiceInput,
  SuspendInput,
  TimeOff,
} from "../types-bolau";

export const bk = {
  all: ["bolau"] as const,
  search: (q: BolauSearchParams) => ["bolau", "search", q] as const,
  trades: ["bolau", "trades"] as const,
  config: ["bolau", "config"] as const,
  sipalu: (handle: string) => ["bolau", "sipalu", handle] as const,
  // Ghardhani (signed-in user)
  me: ["me", "bolau"] as const,
  ghardhani: ["me", "bolau", "ghardhani"] as const,
  addresses: ["me", "bolau", "addresses"] as const,
  favourites: ["me", "bolau", "favourites"] as const,
  bookingsAll: ["me", "bolau", "bookings"] as const,
  bookings: (q?: QueryParams) => ["me", "bolau", "bookings", "list", q ?? {}] as const,
  booking: (id: string) => ["me", "bolau", "bookings", "detail", id] as const,
  contact: (id: string) => ["me", "bolau", "bookings", "contact", id] as const,
  requestsAll: ["me", "bolau", "requests"] as const,
  requests: (q?: QueryParams) => ["me", "bolau", "requests", "list", q ?? {}] as const,
  requestDetail: (id: string) => ["me", "bolau", "requests", "detail", id] as const,
  // Sipalu (self)
  sipaluMe: ["me", "bolau", "sipalu"] as const,
  services: ["me", "bolau", "sipalu", "services"] as const,
  availability: ["me", "bolau", "sipalu", "availability"] as const,
  timeOff: ["me", "bolau", "sipalu", "time-off"] as const,
  // Ops
  opsAll: ["ops", "bolau"] as const,
  opsBookings: (q?: QueryParams) => ["ops", "bolau", "bookings", q ?? {}] as const,
  opsBooking: (id: string) => ["ops", "bolau", "booking", id] as const,
  opsRequests: (q?: QueryParams) => ["ops", "bolau", "requests", q ?? {}] as const,
  opsKpis: ["ops", "bolau", "kpis"] as const,
  opsFees: (q?: QueryParams) => ["ops", "bolau", "fees", q ?? {}] as const,
};

/** Normalise list endpoints that may be paginated or plain arrays. */
function rows<T>(d: Paginated<T> | T[] | null | undefined): T[] {
  if (!d) return [];
  return Array.isArray(d) ? d : (d.results ?? []);
}

/** A stable Idempotency-Key per user intent (one per opened booking form). */
export function newIdempotencyKey(prefix = "bolau"): string {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${r}`;
}

// ---------------------------------------------------------------- discovery (public)
export function useBolauSearch(q: BolauSearchParams, enabled = true) {
  return useQuery({
    queryKey: bk.search(q),
    queryFn: () => api.get<Paginated<SipaluCard>>("/bolau/search", q as QueryParams),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBolauTrades() {
  return useQuery({
    queryKey: bk.trades,
    queryFn: async () => rows(await api.get<Paginated<BolauTrade> | BolauTrade[]>("/bolau/trades")),
    staleTime: 10 * 60_000,
  });
}

/** Client-side lead time before the earliest bookable slot (the API re-checks; contract LEAD_TIME). */
export const BOLAU_LEAD_MINUTES = 60;

/**
 * Public Bolau settings (`GET /bolau/config`): booking fee + whether it is charged (`bolau_fee`),
 * free-cancellation window, accept timeout, minimum hourly rate, offer cap, emergency line. No
 * client-side defaults for money or windows — callers render those lines only once this has loaded;
 * a booking itself always carries the authoritative `booking_fee` + `booking_fee_status`.
 */
export function useBolauConfig() {
  return useQuery({
    queryKey: bk.config,
    queryFn: () => api.get<BolauConfig>("/bolau/config"),
    staleTime: 5 * 60_000,
  });
}

/**
 * The booking's dispute (`GET /bolau/bookings/{id}/dispute`, either party); `null` when there is
 * none (404). Key sits under trustKeys.gharDisputes so evidence uploads / appeals refresh it.
 */
export function useBookingDispute(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: ["me", "bolau", "booking-dispute", "booking", bookingId] as const,
    queryFn: async () => {
      try {
        return await api.get<Dispute>(`/bolau/bookings/${bookingId}/dispute`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled,
  });
}

export function usePublicSipalu(handle: string | undefined, initial?: PublicSipalu) {
  return useQuery({
    queryKey: bk.sipalu(handle ?? ""),
    queryFn: () => api.get<PublicSipalu>(`/public/sipalu/${handle}`),
    enabled: !!handle,
    initialData: initial,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------- Ghardhani profile, addresses, favourites
export function useGhardhani(enabled = true) {
  return useQuery({
    queryKey: bk.ghardhani,
    queryFn: () => api.get<GhardhaniProfile>("/me/ghardhani"),
    enabled,
  });
}

export function useUpdateGhardhani() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<GhardhaniProfile>) => api.patch<GhardhaniProfile>("/me/ghardhani", body),
    onSuccess: (p) => qc.setQueryData(bk.ghardhani, p),
  });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: bk.addresses,
    queryFn: async () => rows(await api.get<Paginated<Address> | Address[]>("/me/addresses")),
    enabled,
  });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AddressInput & { id?: string }) =>
      id ? api.patch<Address>(`/me/addresses/${id}`, body) : api.post<Address>("/me/addresses", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.addresses }),
  });
}

export function useFavourites(enabled = true) {
  return useQuery({
    queryKey: bk.favourites,
    queryFn: async () => rows(await api.get<Paginated<Favourite> | Favourite[]>("/me/favourites")),
    retry: false,
    enabled,
  });
}

export function useToggleFavourite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, on }: { handle: string; on: boolean }) =>
      on ? api.post("/me/favourites", { handle }) : api.delete(`/me/favourites/${handle}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.favourites }),
  });
}

// ---------------------------------------------------------------- bookings (Ghardhani)
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...body }: BookingInput & { idempotencyKey: string }) =>
      request<Booking>("POST", "/bolau/bookings", {
        body: { ...body, idempotency: idempotencyKey },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: bk.bookingsAll });
      if (b?.id) qc.setQueryData(bk.booking(b.id), b);
    },
  });
}

export function useMyBookings(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: bk.bookings(params),
    queryFn: () => api.get<Paginated<Booking>>("/me/bolau/bookings", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: bk.booking(id ?? ""),
    queryFn: () => api.get<Booking>(`/bolau/bookings/${id}`),
    enabled: !!id,
    // Live-ish status while the job is happening (no live location — status only).
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ["requested", "accepted", "on_the_way", "arrived", "in_progress"].includes(s) ? 30_000 : false;
    },
  });
}

export function useBookingContact(id: string, enabled: boolean) {
  return useQuery({
    queryKey: bk.contact(id),
    queryFn: () => api.get<BookingContact>(`/bolau/bookings/${id}/contact`),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

type BookingAction =
  | { action: "cancel"; reason: string }
  | { action: "confirm" }
  | { action: "report-no-show"; reason?: string }
  | { action: "approve-quote" }
  | { action: "reject-quote" }
  | { action: "paid"; method: PayMethod }
  | { action: "rate"; rating: RatingInput }
  | { action: "dispute"; description: string }
  | {
      action: "safety-report";
      report: { safety_kind: string; description: string; emergency?: boolean; anonymous?: boolean };
    };

export function useBookingAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: BookingAction) => {
      const path = `/bolau/bookings/${id}/${a.action}`;
      switch (a.action) {
        case "cancel":
          return api.post<Booking>(path, { reason: a.reason });
        case "paid":
          return api.post<Booking>(path, { method: a.method });
        case "rate":
          return api.post<Booking>(path, a.rating);
        case "report-no-show":
          return api.post<Booking>(path, { reason: a.reason ?? "" });
        case "safety-report":
          return api.post<Booking>(path, a.report);
        case "dispute":
          return api.post<Booking>(path, { description: a.description });
        default:
          return api.post<Booking>(path);
      }
    },
    onSuccess: (b) => {
      // Only a booking payload replaces the cache (dispute / safety-report answer other shapes).
      if (b && typeof b === "object" && "code" in b && "sipalu" in b && "status" in b) qc.setQueryData(bk.booking(id), b);
      qc.invalidateQueries({ queryKey: bk.booking(id) });
      qc.invalidateQueries({ queryKey: bk.bookingsAll });
      qc.invalidateQueries({ queryKey: ["me", "bolau", "booking-dispute"] });
    },
  });
}

// ---------------------------------------------------------------- Kaam requests & offers
export interface KaamRequestInput {
  trade: string;
  title: string;
  description: string;
  address_id: string;
  preferred_window_start?: string;
  preferred_window_end?: string;
  budget_max?: string;
  photos?: File[];
}

export function useCreateKaamRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photos = [], idempotencyKey, ...body }: KaamRequestInput & { idempotencyKey: string }) => {
      const headers = { "Idempotency-Key": idempotencyKey };
      if (!photos.length) return request<KaamRequest>("POST", "/bolau/requests", { body, headers });
      const form = new FormData();
      for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== "") form.append(k, String(v));
      for (const p of photos.slice(0, 4)) form.append("photos", p);
      return request<KaamRequest>("POST", "/bolau/requests", { body: form, headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.requestsAll }),
  });
}

export function useMyRequests(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: bk.requests(params),
    queryFn: () => api.get<Paginated<KaamRequest>>("/me/bolau/requests", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useKaamRequest(id: string | undefined) {
  return useQuery({
    queryKey: bk.requestDetail(id ?? ""),
    queryFn: () => api.get<KaamRequest>(`/bolau/requests/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && ["open", "offers_received"].includes(q.state.data.status) ? 30_000 : false),
  });
}

export function useAcceptOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, offerId }: { requestId: string; offerId: string }) =>
      api.post<Booking>(`/bolau/requests/${requestId}/offers/${offerId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bk.requestsAll });
      qc.invalidateQueries({ queryKey: bk.bookingsAll });
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<KaamRequest>(`/bolau/requests/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.requestsAll }),
  });
}

// ---------------------------------------------------------------- Sipalu (self) onboarding
export function useSipaluMe(enabled = true) {
  return useQuery({
    queryKey: bk.sipaluMe,
    queryFn: () => api.get<SipaluMe>("/me/sipalu"),
    enabled,
    retry: false,
  });
}

export function useUpdateSipaluMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SipaluMe> & Record<string, unknown>) => api.patch<SipaluMe>("/me/sipalu", body),
    onSuccess: (p) => qc.setQueryData(bk.sipaluMe, p),
  });
}

export function useOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, data, file }: { step: string; data: Record<string, unknown>; file?: Record<string, File> }) => {
      if (!file) return api.post<OnboardingResult>("/me/sipalu/onboarding-step", { step, data });
      const form = new FormData();
      form.append("step", step);
      form.append("data", JSON.stringify(data));
      for (const [k, f] of Object.entries(file)) form.append(k, f);
      return api.upload<OnboardingResult>("/me/sipalu/onboarding-step", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.sipaluMe }),
  });
}

export function useSetHandle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) => api.post<SipaluMe>("/me/sipalu/handle", { handle }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.sipaluMe }),
  });
}

export function useMyServices(enabled = true) {
  return useQuery({
    queryKey: bk.services,
    queryFn: async () => rows(await api.get<Paginated<SipaluService> | SipaluService[]>("/me/sipalu/services")),
    enabled,
  });
}

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SipaluServiceInput & { id?: string }) =>
      id
        ? api.patch<SipaluService>(`/me/sipalu/services/${id}`, body)
        : api.post<SipaluService>("/me/sipalu/services", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bk.services });
      qc.invalidateQueries({ queryKey: bk.sipaluMe });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/sipalu/services/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.services }),
  });
}

export function useMyAvailability(enabled = true) {
  return useQuery({
    queryKey: bk.availability,
    queryFn: async () =>
      rows(await api.get<Paginated<AvailabilityRule> | AvailabilityRule[]>("/me/sipalu/availability")),
    enabled,
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: AvailabilityRule[]) => api.put<AvailabilityRule[]>("/me/sipalu/availability", { rules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bk.availability });
      qc.invalidateQueries({ queryKey: bk.sipaluMe });
    },
  });
}

export function useAddTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TimeOff) => api.post<TimeOff>("/me/sipalu/time-off", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.timeOff }),
  });
}

// ---------------------------------------------------------------- ops
export function useOpsBolauBookings(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: bk.opsBookings(params),
    queryFn: () => api.get<Paginated<OpsBooking>>("/ops/bolau/bookings", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOpsBolauBooking(id: string | null) {
  return useQuery({
    queryKey: bk.opsBooking(id ?? ""),
    queryFn: () => api.get<OpsBooking>(`/ops/bolau/bookings/${id}`),
    enabled: !!id,
  });
}

export function useOpsBolauRequests(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: bk.opsRequests(params),
    queryFn: () => api.get<Paginated<KaamRequest & { ghardhani?: { name: string } }>>("/ops/bolau/requests", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOpsBolauKpis(enabled = true) {
  return useQuery({
    queryKey: bk.opsKpis,
    queryFn: () => api.get<OpsBolauKpis>("/ops/bolau/kpis"),
    enabled,
  });
}

export function useOpsBolauFees(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: bk.opsFees(params),
    queryFn: () =>
      api.get<Paginated<FeeLedgerRow> & { totals?: OpsBolauKpis["fees"] }>("/ops/bolau/fees", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOpsBolauSipalu(params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: ["ops", "bolau", "sipalu", params ?? {}] as const,
    queryFn: () => api.get<Paginated<OpsSipaluRow>>("/ops/bolau/sipalu", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOpsSuspendSipalu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, reason, suspend }: SuspendInput) =>
      api.post<OpsSipaluRow>(
        `/ops/bolau/sipalu/${handle}/${suspend ? "suspend" : "unsuspend"}`,
        suspend ? { reason } : { note: reason },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: bk.opsAll }),
  });
}

export function useOpsCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<OpsBooking>(`/ops/bolau/bookings/${id}/cancel`, { reason }),
    onSuccess: (b) => {
      if (b?.id) qc.setQueryData(bk.opsBooking(b.id), b);
      qc.invalidateQueries({ queryKey: bk.opsAll });
    },
  });
}
