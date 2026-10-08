/**
 * First-party product analytics (no third-party trackers). `track()` queues events in memory and
 * flushes them in batches (≤ 50) to `/api/proxy/telemetry/events`; the BFF adds the session.
 *
 * NO PII: only the property keys below are sent — never names, phone numbers, emails, ID/bank
 * numbers or free text. The backend enforces the same allowlist and rejects anything else.
 */
import { PROXY_BASE } from "./api/client";

export type TelemetryEvent =
  | "app_open"
  | "page_view"
  | "login_success"
  | "otp_requested"
  | "onboarding_step"
  | "job_created"
  | "payroll_run_created"
  | "search_performed"
  | "feature_used";

export const ALLOWED_PROPERTIES = [
  "app_version",
  "application_id",
  "bs_month",
  "bs_year",
  "channel",
  "count",
  "duration_ms",
  "error_code",
  "feature",
  "has_photo",
  "industry",
  "job_id",
  "kind",
  "lang",
  "method",
  "openings",
  "org_role",
  "page",
  "plan",
  "result",
  "role",
  "screen",
  "source",
  "status",
  "step",
  "trade",
  "via",
  "wage_type",
] as const;
export type TelemetryProps = Partial<Record<(typeof ALLOWED_PROPERTIES)[number], string | number | boolean | null>>;

interface QueuedEvent {
  name: TelemetryEvent;
  platform: "web";
  properties: Record<string, string | number | boolean | null>;
  occurred_at: string;
  anonymous_id?: string;
}

export const MAX_BATCH = 50;
const FLUSH_MS = 4000;
const ANON_KEY = "ks_anon_id";
const PII_RE = /(?:\+?977[- ]?)?9[678]\d{8}|[^@\s]+@[^@\s]+\.[A-Za-z]{2,}/;
const allowed = new Set<string>(ALLOWED_PROPERTIES);

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

/** Strip anything not on the allowlist (and values that look like PII) before it leaves the browser. */
export function sanitize(props: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!allowed.has(k)) continue;
    if (v === null || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && v.length <= 120 && !PII_RE.test(v))
      out[k] = k === "page" ? v.split(/[?#]/)[0] : v;
  }
  return out;
}

function anonymousId(): string | undefined {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id.length >= 8 ? id.slice(0, 64) : undefined;
  } catch {
    return undefined;
  }
}

function send(batch: QueuedEvent[], beacon = false) {
  const body = JSON.stringify({ events: batch });
  const url = `${PROXY_BASE}/telemetry/events`;
  try {
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // analytics must never break the app
  }
}

export function flush(beacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) send(queue.splice(0, MAX_BATCH), beacon);
}

/** Record a product event. Safe to call anywhere (no-op on the server, never throws). */
export function track(name: TelemetryEvent, props: TelemetryProps = {}) {
  if (typeof window === "undefined") return;
  try {
    queue.push({
      name,
      platform: "web",
      properties: sanitize(props),
      occurred_at: new Date().toISOString(),
      anonymous_id: anonymousId(),
    });
    if (!listening) {
      listening = true;
      window.addEventListener("pagehide", () => flush(true));
    }
    if (queue.length >= MAX_BATCH) flush();
    else if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
  } catch {
    // ignore
  }
}

/** Test helper. */
export function _queued() {
  return queue;
}
export function _reset() {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
