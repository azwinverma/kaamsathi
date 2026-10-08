/** Pure helpers for worker languages (E004) and profile completeness (E008). */
import {
  LANGUAGE_PROFICIENCIES,
  WORKER_LANGUAGE_CODES,
  type LanguageProficiency,
  type WorkerLanguageInput,
} from "@/lib/api/types-moderation";

export interface LanguageRow {
  language: string;
  proficiency: LanguageProficiency;
}

/** Indexes of rows whose language repeats an earlier row (empty selections are ignored). */
export function duplicateLanguageIndexes(rows: { language: string }[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  rows.forEach((r, i) => {
    if (!r.language) return;
    if (seen.has(r.language)) out.push(i);
    seen.add(r.language);
  });
  return out;
}

/** Form rows → API payload (drops blanks, keeps order, de-duplicates). */
export function toLanguagesPayload(rows: LanguageRow[]): WorkerLanguageInput[] {
  const seen = new Set<string>();
  const out: WorkerLanguageInput[] = [];
  for (const r of rows) {
    if (!r.language || seen.has(r.language)) continue;
    seen.add(r.language);
    out.push({
      language: r.language,
      proficiency: (LANGUAGE_PROFICIENCIES as readonly string[]).includes(r.proficiency)
        ? r.proficiency
        : "conversational",
    });
  }
  return out;
}

export function isKnownLanguage(code: string): boolean {
  return (WORKER_LANGUAGE_CODES as readonly string[]).includes(code);
}

/** Bar colour for the profile-completeness percent. */
export function completenessTone(percent: number): "success" | "brand" | "warning" {
  if (percent >= 100) return "success";
  if (percent >= 50) return "brand";
  return "warning";
}

export function clampPercent(v: number | null | undefined): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
