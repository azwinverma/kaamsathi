import { isApiError } from "@/lib/api/errors";
import type { Me } from "@/lib/api/types";
import type { StaffRole } from "@/lib/api/types-security";

/** Short "Browser on OS" description of a User-Agent string (best effort, no deps). */
export function describeUserAgent(ua: string | null | undefined): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };
  const s = ua;
  let browser: string | null = null;
  if (/KaamSathi|okhttp|Dart\//i.test(s)) browser = "KaamSathi app";
  else if (/Edg(e|A|iOS)?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser\//.test(s)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS\//.test(s)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = "Safari";
  else if (/curl\//i.test(s)) browser = "curl";

  let os: string | null = null;
  if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod|iOS/i.test(s)) os = "iOS";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(s)) os = "macOS";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/i.test(s)) os = "Linux";
  return { browser, os };
}

/** Group a base32 secret in blocks of four for manual entry. */
export function formatSecret(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

/** Plain-text file body for "download recovery codes". */
export function recoveryCodesText(codes: readonly string[], opts: { title: string; note: string; account?: string }): string {
  const lines = [opts.title];
  if (opts.account) lines.push(opts.account);
  lines.push("", ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`), "", opts.note, "");
  return lines.join("\n");
}

/** True for the 403 the backend returns on /ops/* while required MFA isn't enrolled. */
export function isMfaRequiredError(e: unknown): boolean {
  return isApiError(e) && e.status === 403 && e.code === "mfa_required";
}

/** Staff user who must enrol MFA before any /ops call succeeds. */
export function needsMfaEnrolment(me: Pick<Me, "is_staff" | "mfa_required" | "mfa_enabled"> | null | undefined): boolean {
  return !!me?.is_staff && me.mfa_required === true && me.mfa_enabled !== true;
}

/** Paths the legal gate never covers (the documents themselves and login). */
const LEGAL_EXEMPT = ["/terms", "/privacy", "/login"];

/** True when the user still has current legal documents to accept on this path. */
export function needsLegalAcceptance(
  me: Pick<Me, "pending_legal"> | null | undefined,
  pathname?: string | null,
): boolean {
  if (!me?.pending_legal?.length) return false;
  if (pathname && LEGAL_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return true;
}

/** Client-side role check (backend is authoritative). Unknown roles (older backend) → allowed. */
export function hasStaffRole(me: Pick<Me, "staff_roles"> | null | undefined, roles: readonly StaffRole[]): boolean {
  const mine = me?.staff_roles;
  if (mine === undefined) return true;
  return mine.includes("superadmin") || roles.some((r) => mine.includes(r));
}

/** Pretty JSON for audit change sets / task args. */
export function prettyJson(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Keep only filled audit filters (so query keys stay stable and URLs clean). */
export function compactFilters<T extends Record<string, unknown>>(f: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    (out as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
