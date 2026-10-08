/** Pure helpers for the hiring pipeline extensions (requirements, invite, tags, interviews, matching). */
import type {
  JobRequirement,
  JobRequirementInput,
  MatchingWeightKey,
  MatchingWeights,
  RequirementCredentialKind,
  RequirementNstbLevel,
} from "@/lib/api/types-pipeline";
import { MATCHING_WEIGHT_KEYS, MAX_TAGS, MAX_TAG_LENGTH } from "@/lib/api/types-pipeline";
import { toLatinDigits } from "@/lib/format";

// ---------------------------------------------------------------- L004 share token
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Skill Passport share token from a pasted link (".../p/s/<token>", with or without query/hash)
 * or a bare token. Returns null when nothing usable is found.
 */
export function extractShareToken(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const m = /\/p\/s\/([A-Za-z0-9_-]+)/.exec(s);
  const candidate = m ? m[1] : s.replace(/[/?#].*$/, "");
  return TOKEN_RE.test(candidate) ? candidate : null;
}

// ---------------------------------------------------------------- L008 tags
/** Lower-cased, trimmed, inner whitespace collapsed (mirrors the server). */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export type TagAddResult =
  | { ok: true; tags: string[] }
  | { ok: false; reason: "empty" | "too_long" | "duplicate" | "limit" };

export function addTag(tags: string[], raw: string): TagAddResult {
  const tag = normalizeTag(raw);
  if (!tag) return { ok: false, reason: "empty" };
  if (tag.length > MAX_TAG_LENGTH) return { ok: false, reason: "too_long" };
  if (tags.includes(tag)) return { ok: false, reason: "duplicate" };
  if (tags.length >= MAX_TAGS) return { ok: false, reason: "limit" };
  return { ok: true, tags: [...tags, tag] };
}

// ---------------------------------------------------------------- J002 requirement rows
export interface RequirementRow {
  /** Stable key for React lists. */
  key: string;
  trade: string;
  credential_kind: RequirementCredentialKind | "";
  nstb_level_min: RequirementNstbLevel | "";
  min_years: string;
  required: boolean;
}

let rowSeq = 0;
export function newRequirementRow(partial: Partial<RequirementRow> = {}): RequirementRow {
  rowSeq += 1;
  return {
    key: `req-${rowSeq}`,
    trade: "",
    credential_kind: "",
    nstb_level_min: "",
    min_years: "",
    required: true,
    ...partial,
  };
}

export function requirementToRow(r: JobRequirement): RequirementRow {
  return newRequirementRow({
    trade: r.trade?.code ?? "",
    credential_kind: r.credential_kind ?? "",
    nstb_level_min: r.nstb_level_min ?? "",
    min_years: r.min_years === null || r.min_years === undefined ? "" : String(r.min_years),
    required: r.required,
  });
}

export type RowProblem = "empty" | "years_invalid" | null;

/** A row needs at least one of trade / credential kind / NSTB level / years; years 0–50. */
export function rowProblem(row: RequirementRow): RowProblem {
  const years = toLatinDigits(row.min_years).trim();
  if (years && !(/^\d+$/.test(years) && Number(years) <= 50)) return "years_invalid";
  if (!row.trade && !row.credential_kind && !row.nstb_level_min && !years) return "empty";
  return null;
}

export function rowToInput(row: RequirementRow): JobRequirementInput {
  const years = toLatinDigits(row.min_years).trim();
  return {
    trade: row.trade || null,
    credential_kind: row.credential_kind || null,
    nstb_level_min: row.nstb_level_min || null,
    min_years: years ? Number(years) : null,
    required: row.required,
  };
}

// ---------------------------------------------------------------- L010 interviews
/** "YYYY-MM-DD" + "HH:MM" of an ISO datetime in Asia/Kathmandu. */
export function ktmParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

// ---------------------------------------------------------------- K001 weights
/** Only the weights whose draft value differs from the saved one (for a partial PATCH). */
export function changedWeights(
  saved: MatchingWeights,
  draft: Record<MatchingWeightKey, string>,
): Partial<MatchingWeights> {
  const out: Partial<MatchingWeights> = {};
  for (const k of MATCHING_WEIGHT_KEYS) {
    const raw = toLatinDigits(draft[k] ?? "").trim();
    if (!/^-?\d+$/.test(raw)) continue;
    const n = Number(raw);
    if (n !== saved[k]) out[k] = n;
  }
  return out;
}

/** Client-side bounds check; returns the keys that are not integers within [min, max]. */
export function invalidWeights(
  draft: Record<MatchingWeightKey, string>,
  limits: Partial<Record<MatchingWeightKey, { min: number; max: number }>>,
): MatchingWeightKey[] {
  return MATCHING_WEIGHT_KEYS.filter((k) => {
    const raw = toLatinDigits(draft[k] ?? "").trim();
    if (!/^-?\d+$/.test(raw)) return true;
    const n = Number(raw);
    const lim = limits[k];
    return lim ? n < lim.min || n > lim.max : false;
  });
}
