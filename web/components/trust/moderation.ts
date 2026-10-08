/** Pure helpers for dispute evidence / appeals (N006/N008) and rating moderation (N004). */
import type { BadgeTone } from "@/components/ui/badge";
import type { RatingCommentStatus } from "@/lib/api/types-moderation";
import type { DisputeStatus } from "@/lib/api/types-trust";

export const EVIDENCE_OPEN_STATUSES: DisputeStatus[] = ["open", "employer_responded", "appealed"];
export const MAX_EVIDENCE = 10;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_ACCEPT = "image/*,application/pdf";

/** Evidence may be added while the dispute is still being decided (and at most 10 files). */
export function canAddEvidence(status: DisputeStatus, count?: number | null): boolean {
  return EVIDENCE_OPEN_STATUSES.includes(status) && (count ?? 0) < MAX_EVIDENCE;
}

export function isDisputeDecided(status: DisputeStatus): boolean {
  return status === "resolved" || status === "rejected" || status === "appeal_resolved";
}

/** Client-side check before uploading; returns an error key or null. */
export function evidenceFileError(file: { type: string; size: number } | null): "required" | "type" | "size" | null {
  if (!file) return "required";
  const okType = file.type === "application/pdf" || /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!okType) return "type";
  if (file.size > MAX_EVIDENCE_BYTES) return "size";
  return null;
}

/** Whole days left until an ISO deadline (0 when past; null when no deadline). */
export function daysUntil(deadline: string | null | undefined, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

export const COMMENT_STATUS_TONE: Record<RatingCommentStatus, BadgeTone> = {
  visible: "success",
  flagged: "warning",
  hidden: "neutral",
};

/** Ops ratings tabs → query params. */
export type RatingsTab = "flagged" | "hidden" | "voided" | "all";
export const RATINGS_TABS: RatingsTab[] = ["flagged", "hidden", "voided", "all"];
export function ratingsTabParams(tab: RatingsTab): { status?: string; voided?: string } {
  switch (tab) {
    case "flagged":
      return { status: "flagged", voided: "false" };
    case "hidden":
      return { status: "hidden", voided: "false" };
    case "voided":
      return { voided: "true" };
    default:
      return {};
  }
}

/** "YYYY-MM" (org received ratings are month-only) → {year, month} or null. */
export function parseYearMonth(v: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}
