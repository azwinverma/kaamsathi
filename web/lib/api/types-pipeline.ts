/**
 * Hiring pipeline extensions (J002 requirements, J006 pause, K001/K010/K012 matching config & runs,
 * L004 employer invite, L008 tags, L009 assignment, L010 interviews).
 */
import type { ISODateTime, Match, NstbLevel, OpsJob, TradeRef, UUID } from "./types";

export interface UserRef {
  id: UUID;
  full_name: string;
}

// ---------------------------------------------------------------- J002 requirements
export const REQUIREMENT_CREDENTIAL_KINDS = [
  "nstb",
  "ctevt_training",
  "training_course",
  "license",
  "safety",
  "language",
  "other",
] as const;
export type RequirementCredentialKind = (typeof REQUIREMENT_CREDENTIAL_KINDS)[number];
export const REQUIREMENT_NSTB_LEVELS = ["level1", "level2", "level3"] as const;
export type RequirementNstbLevel = Extract<NstbLevel, (typeof REQUIREMENT_NSTB_LEVELS)[number]>;
export const MAX_REQUIREMENTS = 10;

export interface JobRequirement {
  id: UUID;
  trade: TradeRef | null;
  credential_kind: RequirementCredentialKind | null;
  credential_kind_label: string | null;
  nstb_level_min: RequirementNstbLevel | null;
  min_years: number | null;
  required: boolean;
  /** Server-built summary, e.g. "Cook · NSTB Level 2+ · 3+ yrs". */
  label: string;
}

export interface JobRequirementInput {
  trade?: string | null;
  credential_kind?: RequirementCredentialKind | null;
  nstb_level_min?: RequirementNstbLevel | null;
  min_years?: number | null;
  required?: boolean;
}

// ---------------------------------------------------------------- L004 invite
export type InviteInput = { worker_id: UUID } | { share_token: string };

// ---------------------------------------------------------------- L008 / L009
export interface ApplicationTagCount {
  tag: string;
  count: number;
}
export interface ApplicationPatch {
  tags?: string[];
  assignee_id?: UUID | null;
}
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

// ---------------------------------------------------------------- L010 interviews
export const INTERVIEW_MODES = ["in_person", "phone", "video", "trade_test"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];
export const INTERVIEW_OUTCOMES = ["pending", "passed", "failed", "no_show"] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

export interface Interview {
  id: UUID;
  application_id: UUID;
  scheduled_at: ISODateTime;
  scheduled_at_bs: string | null;
  mode: InterviewMode;
  mode_label: string;
  location: string;
  interviewer_name: string;
  outcome: InterviewOutcome;
  outcome_label: string;
  notes: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
export interface InterviewInput {
  scheduled_at: ISODateTime;
  mode: InterviewMode;
  location?: string;
  interviewer_name?: string;
  notes?: string;
}
export type InterviewPatch = Partial<InterviewInput> & { outcome?: InterviewOutcome };

// ---------------------------------------------------------------- ops (L009 owner, K010 runs)
export interface OpsJobPipelineFields {
  ops_owner?: UserRef | null;
  invited_count?: number;
  interested_count?: number;
}
export type OpsJobWithPipeline = OpsJob & OpsJobPipelineFields;

export interface MatchRequirementCheck {
  id: UUID;
  label: string;
  required: boolean;
  met: boolean;
}
export interface MatchPipelineFields {
  requirements?: MatchRequirementCheck[];
  rank?: number;
  run_id?: UUID;
  algorithm_version?: string;
}
export type MatchWithPipeline = Match & MatchPipelineFields;

export interface MatchRun {
  id: UUID;
  job_id: UUID;
  algorithm_version: string;
  config: { revision?: number; weights?: Record<string, number> } | null;
  candidates_count: number;
  created_by: UserRef | null;
  created_at: ISODateTime;
}
export interface MatchRunCandidate {
  rank: number;
  score: number;
  worker: UserRef;
  explain: Record<string, number>;
  reasons: string[];
  requirements: MatchRequirementCheck[];
}
export interface MatchRunDetail extends MatchRun {
  candidates: MatchRunCandidate[];
}

// ---------------------------------------------------------------- K001 matching config
export const MATCHING_WEIGHT_KEYS = [
  "trade",
  "district",
  "verified",
  "nstb_per_level",
  "experience_per_year",
  "experience_max",
  "reliability_max",
  "preferred_district",
  "outcomes_max",
  "requirement_met",
  "wage_penalty",
  "declined_penalty",
] as const;
export type MatchingWeightKey = (typeof MATCHING_WEIGHT_KEYS)[number];
export type MatchingWeights = Record<MatchingWeightKey, number>;

export interface MatchingConfig {
  algorithm_version: string;
  revision: number;
  weights: MatchingWeights;
  defaults: MatchingWeights;
  limits: Record<MatchingWeightKey, { min: number; max: number }>;
  updated_by: UserRef | null;
  updated_at: ISODateTime | null;
}
