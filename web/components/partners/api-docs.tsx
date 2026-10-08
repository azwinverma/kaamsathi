import { getTranslations } from "next-intl/server";
import { KeyRound, Lock, ShieldCheck, Webhook } from "lucide-react";

/**
 * Public partner API reference (/partners/docs). Static content; headings and the consent
 * summary are localised, the technical reference stays in English (code is English anyway).
 */

const ENDPOINTS: { method: string; path: string; scope: string; desc: string }[] = [
  {
    method: "GET",
    path: "/partner/workers/{worker_id}/profile",
    scope: "profile.read",
    desc: "Verified profile (Skill Passport payload): identity checks, skills, verified work history, verification level and reliability score, contact phone.",
  },
  {
    method: "GET",
    path: "/partner/workers/{worker_id}/earnings",
    scope: "earnings.read",
    desc: "Verified earnings summary built only from payslips the employer marked paid: verified months, average / min / max monthly net, income stability, SSF months, month-by-month table.",
  },
  {
    method: "GET",
    path: "/partner/workers/{worker_id}/mobility",
    scope: "mobility.read",
    desc: "Foreign-employment document summary for licensed recruitment agencies only: kinds, verified/valid flags, issue and expiry dates, masked numbers. Never document images or full numbers. Requires your agency's DoFE licence to be verified by KaamSathi and unexpired; a suspended or lapsed licence returns 403 even with a live grant.",
  },
  {
    method: "GET",
    path: "/partner/grants?status=active|revoked|expired",
    scope: "—",
    desc: "Consent grants workers have given you. Worker names are included only while a grant is active.",
  },
  {
    method: "GET",
    path: "/partner/referrals?status=",
    scope: "—",
    desc: "Referrals (applications) workers sent you from an offer, with the grant that covers them.",
  },
  {
    method: "POST",
    path: "/partner/referrals/{id}/status",
    scope: "referrals.write",
    desc: "Report your decision: {status: under_review|approved|rejected|disbursed|closed, partner_ref?, amount_approved?, note?}. Only you can move a referral; the worker is notified by SMS.",
  },
];

const PYTHON_VERIFY = `import hashlib, hmac, time

def verify(secret: str, body: bytes, timestamp: str, signature: str) -> bool:
    # Reject replays older than 5 minutes.
    if abs(time.time() - int(timestamp)) > 300:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# Django / Flask: use the RAW request body, not re-serialised JSON.
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

const CURL = `curl https://api.kaamsathi.com.np/api/v1/partner/workers/<worker_id>/earnings \\
  -H "Authorization: Partner ks_ab12cd34_<secret>" \\
  -H "Accept-Language: en"`;

const WEBHOOK_BODY = `POST <your webhook_url>
Content-Type: application/json
X-KaamSathi-Timestamp: 1791360000
X-KaamSathi-Signature: sha256=5f0c…

{"created_at":"2026-10-07T10:15:00+05:45","data":{"amount_requested":"35000.00",
 "grant":{"expires_at":"…","id":"…","purpose":"loan_assessment",
 "scopes":["earnings.read","profile.read"]},"offer":{"id":"…","kind":"tool_finance",
 "title":"Tool finance"},"purpose_note":"…","referral_id":"…","status":"submitted",
 "worker_id":"…"},"event":"referral.created"}`;

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

export async function PartnerApiDocs() {
  const t = await getTranslations("partners.docs");
  const toc = [
    ["consent", t("toc_consent")],
    ["auth", t("toc_auth")],
    ["scopes", t("toc_scopes")],
    ["endpoints", t("toc_endpoints")],
    ["errors", t("toc_errors")],
    ["webhooks", t("toc_webhooks")],
  ] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-3">
        <p className="text-sm font-medium text-brand-text">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>
        <p className="max-w-3xl text-base text-fg-body">{t("intro")}</p>
        <ul className="grid gap-2 pt-2 text-sm text-fg-body sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {t("rule_consent")}
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
            {t("rule_funds")}
          </li>
          <li className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t("rule_logged")}
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
          <Section id="consent" title={t("toc_consent")}>
            <p>{t("consent_1")}</p>
            <p>{t("consent_2")}</p>
            <p>
              Grants are purpose-bound (<code>loan_assessment</code>, <code>insurance</code>, <code>ewa</code>,{" "}
              <code>recruitment</code>, <code>training</code>, <code>verification</code>), carry a list of scopes, and
              expire after at most 90 days. A read succeeds only while an <strong>active, unexpired, unrevoked</strong>{" "}
              grant from that worker to your organisation covers the endpoint&apos;s scope; otherwise you receive{" "}
              <code>403 permission_denied</code>. Every request — allowed or denied — is written to an access log that
              the worker can see in their app.
            </p>
          </Section>

          <Section id="auth" title={t("toc_auth")}>
            <p>
              KaamSathi operations issues API keys of the form <code>ks_&lt;prefix&gt;_&lt;secret&gt;</code>. The full key is
              shown once at creation — we store only a SHA-256 hash, so a lost key must be revoked and re-issued. Send it
              on every request:
            </p>
            <Code label="curl example">{CURL}</Code>
            <p>
              Base URL: <code>https://api.kaamsathi.com.np/api/v1</code>. JSON only, snake_case keys, money as decimal
              strings (<code>&quot;19550.00&quot;</code>), timestamps ISO 8601 (Asia/Kathmandu). A missing, malformed,
              revoked or inactive-partner key returns <code>401 not_authenticated</code>.
            </p>
          </Section>

          <Section id="scopes" title={t("toc_scopes")}>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Scope</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Allows</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["profile.read", "Read a consenting worker's verified profile."],
                    ["earnings.read", "Read a consenting worker's verified earnings summary."],
                    ["passport.read", "Read a consenting worker's Skill Passport (reserved)."],
                    ["mobility.read", "Licensed recruitment agencies only: read the verification status of a consenting worker's passport, permits and clearances (masked; no files). KaamSathi never recruits or matches for jobs abroad — workers choose the agency."],
                    ["referrals.write", "Update the status of referrals sent to you."],
                  ].map(([s, d]) => (
                    <tr key={s} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-fg">{s}</td>
                      <td className="px-4 py-2">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>A key&apos;s scopes limit what it can call; the worker&apos;s grant limits whose data it can read. Both must allow the request.</p>
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
            <p>
              Lists are paginated: <code>?page=1&amp;page_size=25</code> (max 100) →{" "}
              <code>{"{count, next, previous, results}"}</code>.
            </p>
          </Section>

          <Section id="errors" title={t("toc_errors")}>
            <p>
              Errors share one envelope: <code>{'{"error": {"code", "message", "fields"}}'}</code>. Codes you will see:{" "}
              <code>not_authenticated</code> (401), <code>permission_denied</code> (403 — missing key scope or no
              active grant), <code>not_found</code> (404), <code>validation_error</code> and <code>invalid_state</code>{" "}
              (400 — e.g. an illegal referral transition), <code>throttled</code> (429).
            </p>
          </Section>

          <Section id="webhooks" title={t("toc_webhooks")}>
            <p className="flex items-start gap-2">
              <Webhook className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
              <span>
                When a worker applies to one of your offers we POST a <code>referral.created</code> event to your{" "}
                <code>webhook_url</code> (timeout 5 s, up to 3 retries). Respond with any 2xx. The body is signed with your
                webhook secret (shown once by KaamSathi operations):{" "}
                <code>X-KaamSathi-Signature = &quot;sha256=&quot; + HMAC_SHA256(secret, timestamp + &quot;.&quot; + raw_body)</code>.
              </span>
            </p>
            <Code label="Webhook request example">{WEBHOOK_BODY}</Code>
            <h3 className="pt-2 text-base font-semibold text-fg">Verify — Python</h3>
            <Code label="Python signature verification">{PYTHON_VERIFY}</Code>
            <h3 className="pt-2 text-base font-semibold text-fg">Verify — Node.js</h3>
            <Code label="Node.js signature verification">{NODE_VERIFY}</Code>
          </Section>

          <p className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-fg-muted">{t("footer_note")}</p>
        </div>
      </div>
    </div>
  );
}
