/**
 * Types for worker languages / profile completeness (E004/E008), trade aliases (F004)
 * and rating moderation (N004). Evidence / appeal types for disputes live in types-trust.
 */
import type { ISODateTime, Paginated, UUID } from "./types";

// ---------------------------------------------------------------- E004 languages
export const WORKER_LANGUAGE_CODES = [
  "ne",
  "en",
  "hi",
  "mai",
  "bho",
  "new",
  "tha",
  "tam",
  "mgp",
  "gvr",
  "lim",
  "bap",
  "xsr",
  "dty",
  "awa",
  "ur",
  "ar",
  "ms",
  "ja",
  "ko",
  "zh",
] as const;
export type WorkerLanguageCode = (typeof WORKER_LANGUAGE_CODES)[number];

export const LANGUAGE_PROFICIENCIES = ["basic", "conversational", "fluent", "native"] as const;
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];

/** Max languages per worker (backend limit). */
export const MAX_WORKER_LANGUAGES = 15;

export interface WorkerLanguage {
  language: WorkerLanguageCode | string;
  language_label: string;
  proficiency: LanguageProficiency;
  proficiency_label: string;
}

export interface WorkerLanguageInput {
  language: string;
  proficiency?: LanguageProficiency;
}

// ---------------------------------------------------------------- E008 profile completeness
export const PROFILE_COMPLETENESS_KEYS = [
  "photo",
  "identity",
  "skills",
  "languages",
  "availability",
  "verified_credential",
  "work_history",
  "payment_details",
] as const;
export type ProfileCompletenessKey = (typeof PROFILE_COMPLETENESS_KEYS)[number];

export interface ProfileCompleteness {
  /** 0–100 */
  percent: number;
  missing: ProfileCompletenessKey[];
  items: { key: ProfileCompletenessKey; done: boolean; label: string }[];
}

// ---------------------------------------------------------------- F004 trade aliases
export const ALIAS_LANGUAGES = ["en", "ne", "ne_rom", "hi", "other"] as const;
export type AliasLanguage = (typeof ALIAS_LANGUAGES)[number];

export interface TradeAlias {
  id: UUID;
  alias: string;
  language: AliasLanguage;
  language_label: string;
  trade: string;
  created_at: ISODateTime;
}

export interface TradeAliasInput {
  alias: string;
  language: AliasLanguage;
}

// ---------------------------------------------------------------- N004 rating moderation
export type RatingCommentStatus = "visible" | "flagged" | "hidden";
export type RatingRater = "employer" | "worker";

export interface RatingEntry {
  id: UUID;
  rater: RatingRater;
  /** Employer → worker: reliability. Worker → employer: paid on time. */
  score_a: number;
  /** Employer → worker: skill. Worker → employer: working conditions. */
  score_b: number;
  /** null when hidden by ops. */
  comment: string | null;
  comment_status: RatingCommentStatus;
  comment_status_label: string;
  voided: boolean;
  created_at: string;
}

/** GET /org/ratings/received — `created_at` is "YYYY-MM" (month only). */
export interface OrgReceivedRating extends RatingEntry {
  can_flag: boolean;
}

export interface OrgReceivedRatings {
  count: number;
  min_ratings: number;
  results: OrgReceivedRating[];
}

/** GET /ops/ratings row. */
export interface OpsRating extends RatingEntry {
  employment_id: UUID;
  organization: { id: UUID; name: string };
  worker: { id: UUID; full_name: string };
  flag_reason: string | null;
  flagged_at: ISODateTime | null;
  flagged_by: { id: UUID; full_name: string } | null;
  moderation_note: string | null;
  moderated_at: ISODateTime | null;
  void_reason: string | null;
  voided_at: ISODateTime | null;
}

export type OpsRatingsPage = Paginated<OpsRating>;
