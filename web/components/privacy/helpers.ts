import type { BadgeTone } from "@/components/ui/badge";
import { PROXY_BASE } from "@/lib/api/client";
import type { PrivacyRequest, PrivacyRequestStatus } from "@/lib/api/types-privacy";

/**
 * Ops can act only on requests that are still open. An approved export sits in_progress while
 * Celery builds the bundle — that one is already handled, so no actions.
 */
export function canProcess(r: Pick<PrivacyRequest, "status" | "kind" | "handled_by">): boolean {
  if (r.status === "received") return true;
  if (r.status === "in_progress") return !(r.kind === "export" && r.handled_by);
  return false;
}

export const PRIVACY_STATUS_TONE: Record<PrivacyRequestStatus, BadgeTone> = {
  received: "warning",
  in_progress: "brand",
  completed: "success",
  rejected: "danger",
};

export type ExportFileState = "none" | "preparing" | "ready" | "expired";

/** Where an export request's bundle stands (only meaningful for kind=export). */
export function exportFileState(
  r: Pick<PrivacyRequest, "kind" | "status" | "file_available" | "file_expires_at">,
  now: Date = new Date(),
): ExportFileState {
  if (r.kind !== "export" || r.status === "rejected") return "none";
  if (r.file_available) {
    if (r.file_expires_at && new Date(r.file_expires_at).getTime() <= now.getTime())
      return "expired";
    return "ready";
  }
  if (r.status === "completed") return r.file_expires_at ? "expired" : "none";
  return r.status === "in_progress" ? "preparing" : "none";
}

/** Same-origin download link (through the BFF proxy) — never the API's own download_url. */
export function privacyDownloadHref(id: string): string {
  return `${PROXY_BASE}/ops/privacy-requests/${encodeURIComponent(id)}/download`;
}

/** Reject requires a non-blank note; approve may omit it. Returns the trimmed note or an error flag. */
export function validateProcessNote(
  action: "approve" | "reject",
  note: string,
): { ok: true; note: string | undefined } | { ok: false } {
  const trimmed = note.trim();
  if (action === "reject" && !trimmed) return { ok: false };
  return { ok: true, note: trimmed || undefined };
}
