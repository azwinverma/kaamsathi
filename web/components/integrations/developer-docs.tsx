import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { KeyRound, ShieldCheck, Webhook } from "lucide-react";

/**
 * Public enterprise API + webhook reference (/developers). Headings and guidance are localised;
 * the technical reference (paths, payloads, code) stays in English.
 */

const BASE = "https://api.kaamsathi.com.np/api/v1";

const SCOPES: [string, string][] = [
  ["jobs.read", "List your job openings."],
  ["jobs.write", "Create job openings (minimum-wage rules apply exactly as in the app)."],
  ["workforce.read", "List employments (workers, sites, wages, status)."],
  ["attendance.read", "Read hajiri (attendance) for a date range."],
  ["attendance.write", "Record hajiri in bulk — e.g. from biometric or turnstile systems."],
  ["payroll.read", "List payroll runs and their payslips."],
  ["timesheets.read", "Read weekly timesheets and approved overtime."],
];

const ENDPOINTS: { method: string; path: string; scope: string; desc: string }[] = [
  { method: "GET", path: "/enterprise/jobs?status=open,draft", scope: "jobs.read", desc: "Job openings, newest first." },
  {
    method: "POST",
    path: "/enterprise/jobs",
    scope: "jobs.write",
    desc: '{title, trade, wage_type: monthly|daily, wage_amount, openings_count, site_id?, shift_id?, start_date?, description?, food_provided?, accommodation_provided?, min_experience_years?}. Below the minimum wage → 400 below_minimum_wage. Created as a draft; publish it in KaamSathi.',
  },
  {
    method: "GET",
    path: "/enterprise/employments?status=active&site=",
    scope: "workforce.read",
    desc: "Employments with worker card, site, shift, trade, wage fields and status.",
  },
  {
    method: "GET",
    path: "/enterprise/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&site=",
    scope: "attendance.read",
    desc: "Attendance records (at most 62 days per request; default the last 7 days).",
  },
  {
    method: "POST",
    path: "/enterprise/attendance/bulk",
    scope: "attendance.write",
    desc: '{records: [{client_uuid, employment_id, date, status: present|absent|half_day|leave|holiday|weekly_off, check_in_at?, check_out_at?, overtime_minutes?, note?}]} — up to 1000. Upserts by client_uuid then (employment, date); returns {saved: [client_uuid], errors: [{client_uuid, code, message}]}. Months with approved payroll are locked (invalid_state). Send an Idempotency-Key header to make retries safe.',
  },
  { method: "GET", path: "/enterprise/payroll-runs", scope: "payroll.read", desc: "Payroll runs by BS month with totals and status." },
  {
    method: "GET",
    path: "/enterprise/payroll-runs/{id}/payslips",
    scope: "payroll.read",
    desc: "Payslips of a run: days, earnings, OT, SSF, TDS, deductions, net pay, payment status.",
  },
  {
    method: "GET",
    path: "/enterprise/timesheets?week_start=YYYY-MM-DD&status=",
    scope: "timesheets.read",
    desc: "Weekly timesheets (week starts Sunday): per-day minutes, regular, OT claimed/approved, over_cap.",
  },
];

const EVENTS: [string, string][] = [
  ["application.stage_changed", "A candidate moved stage (shortlisted, interview, selected, joined…)."],
  ["employment.started", "A worker joined (employment created)."],
  ["employment.ended", "An employment ended (end_date, end_reason)."],
  ["payroll.run_approved", "A payroll run was approved (the month's hajiri is now locked)."],
  ["payroll.run_paid", "A payroll run was marked paid."],
  ["timesheet.approved", "A weekly timesheet was approved, with approved overtime minutes."],
  ["dispute.raised", "A worker raised a dispute with your organisation."],
  ["support_case.updated", "One of your organisation's support cases changed."],
];

const CURL = `curl ${BASE}/enterprise/employments?status=active \\
  -H "Authorization: Org ks_org_ab12cd34_<secret>"

curl -X POST ${BASE}/enterprise/attendance/bulk \\
  -H "Authorization: Org ks_org_ab12cd34_<secret>" \\
  -H "Idempotency-Key: 2026-10-07-gate-1" \\
  -H "Content-Type: application/json" \\
  -d '{"records":[{"client_uuid":"6f1c…","employment_id":"…","date":"2026-10-07",
       "status":"present","check_in_at":"2026-10-07T08:58:00+05:45"}]}'`;

const WEBHOOK_BODY = `POST <your endpoint URL>
Content-Type: application/json
X-KaamSathi-Event: timesheet.approved
X-KaamSathi-Delivery: 9b7e…
X-KaamSathi-Timestamp: 1791360000
X-KaamSathi-Signature: sha256=5f0c…

{"created_at":"2026-10-07T10:15:00+05:45","data":{"employment_id":"…",
 "overtime_minutes_approved":120,"overtime_minutes_claimed":180,"regular_minutes":2400,
 "timesheet_id":"…","week_start":"2026-10-04","worker":{"full_name":"…","id":"…"}},
 "event":"timesheet.approved","id":"9b7e…","organization_id":"…"}`;

const PYTHON_VERIFY = `import hashlib, hmac, time

def verify(secret: str, body: bytes, timestamp: str, signature: str) -> bool:
    if abs(time.time() - int(timestamp)) > 300:   # reject replays older than 5 minutes
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# Use the RAW request body, never re-serialised JSON.
ok = verify(WEBHOOK_SECRET, request.body,
            request.headers["X-KaamSathi-Timestamp"],
            request.headers["X-KaamSathi-Signature"])`;

const NODE_VERIFY = `import crypto from "node:crypto";

export function verify(secret, rawBody, timestamp, signature) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(\`\${timestamp}.\`).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-surface-muted p-4 font-mono text-xs leading-relaxed text-fg"
    >
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-3">
      <h2 id={`${id}-h`} className="text-xl font-semibold text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RefTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs text-fg-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">
              {head[0]}
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              {head[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-t border-border">
              <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-fg">{a}</td>
              <td className="px-4 py-2">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function DeveloperDocs() {
  const t = await getTranslations("developers");
  const toc = [
    ["start", t("toc_start")],
    ["auth", t("toc_auth")],
    ["scopes", t("toc_scopes")],
    ["endpoints", t("toc_endpoints")],
    ["errors", t("toc_errors")],
    ["webhooks", t("toc_webhooks")],
    ["verify", t("toc_verify")],
  ] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-3">
        <p className="text-sm font-medium text-brand-text">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>
        <p className="max-w-3xl text-base text-fg-body">{t("intro")}</p>
        <ul className="grid gap-2 pt-2 text-sm text-fg-body sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
            {t("rule_keys")}
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {t("rule_scope")}
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <Webhook className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t("rule_signed")}
          </li>
        </ul>
      </header>
      <div className="grid gap-10 lg:grid-cols-[12rem_1fr]">
        <nav aria-label={t("contents")} className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">{t("contents")}</p>
          <ol className="space-y-1 text-sm">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-fg-body hover:text-brand-text">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 space-y-10 text-sm leading-relaxed text-fg-body">
          <Section id="start" title={t("toc_start")}>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("start_1")}</li>
              <li>{t("start_2")}</li>
              <li>{t("start_3")}</li>
            </ol>
            <p>
              <Link href="/app/integrations" className="font-medium text-brand-text hover:underline">
                {t("open_integrations")}
              </Link>
            </p>
          </Section>

          <Section id="auth" title={t("toc_auth")}>
            <p>
              Keys look like <code>ks_org_&lt;prefix&gt;_&lt;secret&gt;</code>. The full key is shown once — KaamSathi stores
              only a SHA-256 hash, so a lost key must be revoked and replaced. Send it on every request as{" "}
              <code>Authorization: Org &lt;key&gt;</code>. No <code>X-Org-Id</code> header is needed: the key belongs to
              one organisation and can only see that organisation&apos;s data.
            </p>
            <Code label="curl examples">{CURL}</Code>
            <p>
              Base URL <code>{BASE}</code>. JSON only, snake_case keys, money as decimal strings (
              <code>&quot;19550.00&quot;</code>), dates <code>YYYY-MM-DD</code> (AD), timestamps ISO 8601 in
              Asia/Kathmandu. Lists are paginated: <code>?page=1&amp;page_size=25</code> (max 100) →{" "}
              <code>{"{count, next, previous, results}"}</code>.
            </p>
          </Section>

          <Section id="scopes" title={t("toc_scopes")}>
            <RefTable head={["Scope", "Allows"]} rows={SCOPES} />
          </Section>

          <Section id="endpoints" title={t("toc_endpoints")}>
            <ul className="space-y-3">
              {ENDPOINTS.map((e) => (
                <li key={e.method + e.path} className="rounded-lg border border-border bg-surface p-4">
                  <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-brand-subtle px-1.5 py-0.5 font-semibold text-brand-subtle-fg">{e.method}</span>
                    <span className="break-all text-fg">{e.path}</span>
                    <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-fg-muted">scope: {e.scope}</span>
                  </p>
                  <p className="mt-2">{e.desc}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="errors" title={t("toc_errors")}>
            <p>
              One envelope for every error: <code>{'{"error": {"code", "message", "fields", "request_id"}}'}</code>.{" "}
              <code>not_authenticated</code> (401 — missing, malformed or revoked key), <code>permission_denied</code>{" "}
              (403 — the key lacks the scope), <code>not_found</code> (404 — including another organisation&apos;s
              objects), <code>validation_error</code>, <code>below_minimum_wage</code>, <code>invalid_state</code> (400),{" "}
              <code>idempotency_conflict</code> (409 — same Idempotency-Key, different body), <code>throttled</code> (429).
            </p>
          </Section>

          <Section id="webhooks" title={t("toc_webhooks")}>
            <p>{t("webhooks_1")}</p>
            <RefTable head={["Event", "When"]} rows={EVENTS} />
            <p>
              Every delivery is a <code>POST</code> with a JSON envelope{" "}
              <code>{"{id, event, created_at, organization_id, data}"}</code>. Answer with any 2xx within 10 seconds;
              redirects are not followed. Failed deliveries are retried after <strong>1 min, 5 min, 30 min, 2 h and 12 h</strong>{" "}
              (6 attempts in all), then marked failed — you can redeliver from the delivery log. Deliveries can arrive more
              than once or out of order: de-duplicate on <code>id</code> (also in <code>X-KaamSathi-Delivery</code>).
              Use &quot;Send test&quot; to receive a <code>ping</code> event.
            </p>
            <Code label="Webhook request example">{WEBHOOK_BODY}</Code>
          </Section>

          <Section id="verify" title={t("toc_verify")}>
            <p>
              <code>X-KaamSathi-Signature = &quot;sha256=&quot; + hex(HMAC_SHA256(secret, timestamp + &quot;.&quot; + raw_body))</code>{" "}
              with <code>timestamp</code> from <code>X-KaamSathi-Timestamp</code> (Unix seconds). {t("verify_1")}
            </p>
            <h3 className="pt-2 text-base font-semibold text-fg">Python</h3>
            <Code label="Python signature verification">{PYTHON_VERIFY}</Code>
            <h3 className="pt-2 text-base font-semibold text-fg">Node.js</h3>
            <Code label="Node.js signature verification">{NODE_VERIFY}</Code>
          </Section>

          <p className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-fg-muted">{t("footer_note")}</p>
        </div>
      </div>
    </div>
  );
}
