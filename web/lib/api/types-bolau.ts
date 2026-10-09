/**
 * Bolau types — Sipalu self-profiles, Ghardhani bookings, Kaam requests and offers
 * (docs/CONTRACT-BOLAU.md). Money is a decimal string, dates AD ISO (+ `_bs` where the API sends it).
 */
import type { DistrictRef, ISODate, ISODateTime, Money, TradeRef, UUID } from "./types";

// ---------------------------------------------------------------- shared
export type PriceType = "fixed" | "hourly" | "visit_then_quote";
export const PRICE_TYPES: PriceType[] = ["fixed", "hourly", "visit_then_quote"];

export type BookingStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "expired"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "disputed";

export type BookingFeeStatus = "waived" | "pending" | "paid" | "refunded";
export type PayMethod = "cash" | "esewa" | "khalti" | "bank";
export const PAY_METHODS: PayMethod[] = ["cash", "esewa", "khalti", "bank"];

export type RequestStatus = "open" | "offers_received" | "booked" | "expired" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired";

export const RATING_TAGS = ["on_time", "clean_work", "polite", "fair_price", "skilled", "explained_work"] as const;
export type RatingTag = (typeof RATING_TAGS)[number] | string;

export interface TradeSummary extends TradeRef {
  years?: number | null;
  nstb_level?: string | null;
}

// ---------------------------------------------------------------- discovery
export interface SipaluCard {
  handle: string;
  name: string;
  name_ne?: string | null;
  photo_url: string | null;
  headline: string;
  headline_ne?: string | null;
  top_trade: TradeRef | null;
  rating_avg: number | string | null;
  rating_count: number;
  jobs_completed: number;
  verification_level: number;
  from_price: Money | null;
  from_price_type?: PriceType | null;
  next_available: ISODateTime | null;
  distance_band?: string | null;
  instant_booking: boolean;
  languages?: string[];
  districts?: DistrictRef[];
  public_indexable?: boolean;
}

export interface BolauSearchParams {
  trade?: string;
  district?: string;
  q?: string;
  date?: ISODate;
  time?: string;
  max_price?: string | number;
  instant?: 1 | "1";
  min_rating?: string | number;
  language?: string;
  gender?: "female" | "male";
  page?: number;
  page_size?: number;
}

export interface BolauTrade extends TradeRef {
  sipalu_count?: number;
  typical_services?: { title: string; title_ne?: string | null; price_type: PriceType; median_price: Money | null }[];
}

// ---------------------------------------------------------------- public profile
export interface SipaluService {
  id: UUID;
  trade: TradeRef | string | null;
  title: string;
  title_ne?: string | null;
  description?: string | null;
  price_type: PriceType;
  price: Money | null;
  visit_fee?: Money | null;
  estimated_minutes?: number | null;
  is_active?: boolean;
  order?: number;
}

/** weekday 0–6 per backend (see AVAILABILITY_WEEKDAY_BASE in lib/bolau/slots.ts). */
export interface AvailabilityRule {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id?: UUID;
  from_date: ISODate;
  to_date: ISODate;
  note?: string | null;
}

export interface AvailabilitySummary {
  /** API shape: weekday (0 = Sunday) → [["08:00","17:00"], …]. Use summaryRules() to flatten. */
  weekly?: { weekday: number; ranges: [string, string][] }[];
  rules?: AvailabilityRule[];
  time_off?: TimeOff[];
  /** Already-booked windows (no PII) so the slot picker can skip them. */
  busy?: { start: ISODateTime; end: ISODateTime }[];
  next_available?: ISODateTime | null;
  text?: string | null;
  text_ne?: string | null;
}

export interface PublicReview {
  score: number;
  comment: string | null;
  month_bs: string | null;
  first_name?: string | null;
  tags?: string[];
  tag_labels?: string[];
}

export interface LanguageRef {
  language: string;
  language_label?: string;
  proficiency?: string;
  proficiency_label?: string;
}

export interface PublicSipalu {
  handle: string;
  name: string;
  name_ne: string | null;
  photo_url: string | null;
  headline: string;
  headline_ne: string | null;
  bio: string | null;
  bio_ne: string | null;
  trades: TradeSummary[];
  languages: (LanguageRef | string)[];
  verification_level: number;
  verified_badges: string[];
  rating_avg: number | string | null;
  rating_count: number;
  jobs_completed: number;
  response_time_minutes: number | null;
  services: SipaluService[];
  service_districts: DistrictRef[];
  availability_summary: AvailabilitySummary | null;
  portfolio: { thumb_url: string; caption: string | null; caption_ne?: string | null }[];
  reviews: PublicReview[];
  passport_url?: string | null;
  instant_booking?: boolean;
  /** SEO opt-in (API field `indexable`); noindex unless true. */
  indexable?: boolean;
  public_indexable?: boolean;
  bookable?: boolean;
  years_total?: number | null;
  from_price?: Money | null;
  public_url?: string;
}

// ---------------------------------------------------------------- Ghardhani
export interface GhardhaniProfile {
  display_name: string;
  preferred_language: "en" | "ne";
  created_at?: ISODateTime;
}

export type AddressLabel = "home" | "office" | "other";
export interface Address {
  id: UUID;
  label: AddressLabel;
  line: string;
  ward: string | number | null;
  municipality: string;
  district: DistrictRef | string | null;
  landmark?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  is_default: boolean;
}
export interface AddressInput {
  label: AddressLabel;
  line: string;
  ward?: string | number | null;
  municipality: string;
  district: string;
  landmark?: string;
  is_default?: boolean;
}

/** GET /me/favourites returns Sipalu cards. */
export type Favourite = SipaluCard;

// ---------------------------------------------------------------- bookings
export interface BookingParty {
  handle?: string | null;
  phone_masked?: string | null;
  phone?: string | null;
  name: string;
  name_ne?: string | null;
  photo_url?: string | null;
  verification_level?: number;
  rating_avg?: number | string | null;
}

export interface BookingEvent {
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  to_status_label?: string;
  by_party?: "ghardhani" | "sipalu" | "ops" | "system" | string | null;
  note?: string | null;
  at: ISODateTime;
}

export interface Booking {
  id: UUID;
  code: string;
  status: BookingStatus;
  status_label?: string;
  sipalu: BookingParty;
  ghardhani?: BookingParty;
  service: SipaluService | null;
  trade: TradeRef | null;
  description: string;
  address: Address | null;
  address_text?: string | null;
  scheduled_start: ISODateTime;
  estimated_minutes: number | null;
  price_type: PriceType;
  quoted_price: Money | null;
  visit_fee: Money | null;
  final_price: Money | null;
  /** visit_then_quote: the Sipalu's quote after the visit, and whether the Ghardhani approved it. */
  quote_amount?: Money | null;
  quote_status?: "none" | "proposed" | "approved" | "rejected";
  booking_fee: Money;
  booking_fee_status: BookingFeeStatus;
  cancelled_by?: "ghardhani" | "sipalu" | "ops" | null;
  cancel_reason?: string | null;
  /** Shown only to the Ghardhani while the Sipalu is on the way. */
  arrival_code?: string | null;
  arrival_verified_at?: ISODateTime | null;
  started_at?: ISODateTime | null;
  completed_at?: ISODateTime | null;
  confirmed_at?: ISODateTime | null;
  /** Direct payment Ghardhani → Sipalu; both sides mark it, KaamSathi never holds it. */
  payment_to_sipalu?: {
    method: PayMethod | null;
    ghardhani_marked_at: ISODateTime | null;
    ghardhani_method: PayMethod | null;
    sipalu_marked_at: ISODateTime | null;
    sipalu_method: PayMethod | null;
    agreed: boolean;
  };
  payment_method_to_sipalu?: PayMethod | null;
  paid_to_sipalu_at?: ISODateTime | null;
  paid_to_sipalu_marked_by?: string | null;
  free_cancel_until?: ISODateTime | null;
  can_rate?: boolean;
  my_rating?: { score: number; comment?: string | null; tags?: string[] } | null;
  contact_visible?: boolean;
  contact_visible_until?: ISODateTime | null;
  late_cancellation?: boolean;
  expires_at?: ISODateTime | null;
  my_role?: "ghardhani" | "sipalu" | "ops";
  source?: "direct" | "request";
  events?: BookingEvent[];
  created_at: ISODateTime;
  updated_at?: ISODateTime;
}

export interface BookingInput {
  sipalu_handle: string;
  service_id?: UUID | null;
  trade: string;
  description: string;
  address_id: UUID;
  scheduled_start: ISODateTime;
  estimated_minutes?: number | null;
}

/** GET /bolau/bookings/{id}/contact — the other party's phone only inside the accepted window. */
export interface BookingContact {
  visible: boolean;
  phone: string | null;
  phone_masked: string | null;
  visible_until: ISODateTime | null;
  emergency_line?: string;
}

export interface RatingInput {
  score: number;
  comment?: string;
  tags?: string[];
}

// ---------------------------------------------------------------- requests & offers
export interface Offer {
  id: UUID;
  sipalu: SipaluCard | BookingParty;
  price_type: PriceType;
  price: Money | null;
  visit_fee: Money | null;
  message: string;
  proposed_start: ISODateTime | null;
  status: OfferStatus;
  created_at: ISODateTime;
}

export interface KaamRequest {
  id: UUID;
  code: string;
  trade: TradeRef | null;
  title: string;
  description: string | null;
  /** Signed image URLs. */
  photos: (string | { url: string; thumb_url?: string | null })[];
  address: Address | null;
  preferred_window_start: ISODateTime | null;
  preferred_window_end: ISODateTime | null;
  budget_max: Money | null;
  status: RequestStatus;
  expires_at: ISODateTime;
  offers?: Offer[];
  offers_count?: number;
  offers_left?: number;
  ghardhani?: { id: string; name: string };
  booking_id?: UUID | null;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------- Sipalu (self)
export interface SipaluMe {
  handle: string | null;
  headline: string;
  headline_ne: string | null;
  bio: string | null;
  bio_ne: string | null;
  bolau_enabled: boolean;
  instant_booking: boolean;
  service_districts: DistrictRef[];
  service_radius_km: number | null;
  gender_visible?: boolean;
  public_indexable?: boolean;
  completed_steps?: string[];
  next_step?: string | null;
  completeness?: Completeness;
  verification_status?: string;
  handle_change_available_at?: ISODateTime | null;
  public_url?: string;
  name?: string;
  name_ne?: string | null;
  photo_url?: string | null;
  bookable?: boolean;
  bookable_problems?: string[];
  trades?: TradeSummary[];
  languages?: LanguageRef[];
  service_municipality?: string | null;
  public_consent?: boolean;
  suspended?: { at: ISODateTime; reason: string | null } | null;
  services?: SipaluService[];
  availability?: AvailabilityRule[];
  payment?: {
    method: string | null;
    wallet_id: string | null;
    bank_name: string | null;
    bank_account_masked: string | null;
    bank_account_name: string | null;
  };
}

export interface Completeness {
  percent: number;
  missing: string[];
  items: { key: string; done: boolean; optional: boolean; label: string }[];
}

export interface OnboardingResult {
  completed_steps: string[];
  next_step: string | null;
  completeness: Completeness;
}

export interface SipaluServiceInput {
  trade: string;
  title: string;
  title_ne?: string;
  description?: string;
  price_type: PriceType;
  price?: string | null;
  visit_fee?: string | null;
  estimated_minutes?: number | null;
  is_active?: boolean;
}

// ---------------------------------------------------------------- config / ops
export interface BolauConfig {
  booking_fee: Money;
  fee_enabled: boolean;
  free_cancel_hours: number;
  lead_time_minutes: number;
  min_hourly?: Money;
}

export interface OpsBolauKpis {
  days?: number;
  bookings?: number;
  bookings_per_day?: number | string | null;
  acceptance_rate?: number | string | null;
  time_to_accept_minutes_median?: number | string | null;
  completion_rate?: number | string | null;
  cancellation_rate?: number | string | null;
  repeat_ghardhani_rate?: number | string | null;
  avg_rating?: number | string | null;
  disputes?: number;
  no_shows?: number;
  late_cancellations?: number;
  fees?: Record<BookingFeeStatus, { count: number; amount: Money }>;
}

export interface OpsBooking extends Booking {
  ghardhani: BookingParty & { user_id?: UUID; rating?: unknown };
  ratings?: { id: UUID; side: "ghardhani" | "sipalu"; score: number; comment: string | null; comment_status?: string }[];
  reports?: { id: UUID; reason: string; reporter_side: string; note: string | null; created_at: ISODateTime }[];
  disputes?: { id: UUID; status: string }[];
}

export interface FeeLedgerRow {
  booking_id: UUID;
  code: string;
  charge_id?: UUID;
  payer: { user_id: UUID; name: string } | null;
  amount: Money;
  status: BookingFeeStatus;
  status_label?: string;
  provider: string | null;
  reference: string | null;
  paid_at: ISODateTime | null;
  refund_manual?: boolean;
  created_at: ISODateTime;
}

export interface OpsSipaluRow extends SipaluCard {
  worker_id: UUID;
  verification_status: string;
  bolau_enabled: boolean;
  suspended_at: ISODateTime | null;
  suspension_reason: string | null;
  public_consent: boolean;
}

export interface SuspendInput {
  handle: string;
  reason: string;
  suspend: boolean;
}
